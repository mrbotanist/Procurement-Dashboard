// Bulk import: npm run import -- <suppliers|products|pos> <file.csv|file.xlsx> [--dry-run]
// See import-templates/README.md for the columns.

import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { addDays, fromIsoDate, todayIso } from "../src/lib/dates";
import { defaultSchedule } from "../src/lib/domain/payments";
import { poTotal } from "../src/lib/domain/totals";
import { createPrismaClient } from "../src/lib/prisma-client";
import { syncNotifications } from "../src/server/jobs/notifications";
import { recalcPo, refreshSupplierStats } from "../src/server/recalc";

type Row = Record<string, string>;
const db = createPrismaClient();

// ─── Reading files ───────────────────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

async function readRows(file: string): Promise<Row[]> {
  let table: string[][];
  if (/\.xlsx$/i.test(file)) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.worksheets[0];
    table = [];
    ws.eachRow((r) => {
      const values = (r.values as unknown[]).slice(1).map((v) => {
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
        if (v && typeof v === "object" && "result" in v) return String((v as { result: unknown }).result);
        return v == null ? "" : String(v);
      });
      table.push(values);
    });
  } else {
    table = parseCsv(await readFile(file, "utf8"));
  }
  const [header, ...body] = table;
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const opt = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
const num = (v: string | undefined, d = 0) => (v && v.trim() ? Number(v.replace(/[, $]/g, "")) : d);

// ─── Importers ───────────────────────────────────────────────────────────────

async function importSuppliers(rows: Row[], dry: boolean) {
  const schema = z.object({ name: z.string().min(1), code: z.string().regex(/^[A-Z]{2,4}$/), country: z.string().min(1) });
  let created = 0, updated = 0;
  for (const [i, r] of rows.entries()) {
    const data = {
      name: r.name, code: (r.code ?? "").toUpperCase(), city: opt(r.city), country: r.country, contactName: opt(r.contact_name), email: opt(r.email),
      phone: opt(r.phone), website: opt(r.website), paymentTerms: opt(r.payment_terms), currency: (opt(r.currency) ?? "USD").toUpperCase(),
      incoterm: opt(r.incoterm), incotermPlace: opt(r.incoterm_place), notes: opt(r.notes),
    };
    const ok = schema.safeParse(data);
    if (!ok.success) throw new Error(`Row ${i + 2}: ${ok.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
    const existing = await db.supplier.findUnique({ where: { name: data.name } });
    if (!dry) await db.supplier.upsert({ where: { name: data.name }, update: data, create: data });
    if (existing) updated++;
    else created++;
  }
  return `${created} suppliers created, ${updated} updated`;
}

async function importProducts(rows: Row[], dry: boolean) {
  let created = 0, updated = 0;
  for (const [i, r] of rows.entries()) {
    const sku = (r.sku ?? "").toUpperCase();
    if (!sku || !r.name || !r.brand) throw new Error(`Row ${i + 2}: sku, name and brand are required`);
    const existing = await db.product.findUnique({ where: { sku } });
    if (!dry) {
      const brand = await db.brand.upsert({ where: { name: r.brand }, update: {}, create: { name: r.brand } });
      const data = { name: r.name, brandId: brand.id, category: opt(r.category) ?? "Uncategorized", stockQty: Math.round(num(r.stock)), dailySalesRate: num(r.daily_sales) };
      await db.product.upsert({ where: { sku }, update: data, create: { sku, ...data } });
    }
    if (existing) updated++;
    else created++;
  }
  return `${created} products created, ${updated} updated`;
}

async function importPos(rows: Row[], dry: boolean) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = opt(r.po_number) ?? `${r.supplier}|${r.brand}|${r.order_date}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const today = todayIso();
  const out: string[] = [];
  const touchedSuppliers = new Set<string>();
  for (const [key, lines] of groups) {
    const h = lines[0];
    const supplier = await db.supplier.findUnique({ where: { name: h.supplier } });
    if (!supplier) throw new Error(`PO ${key}: unknown supplier "${h.supplier}" (import suppliers first)`);
    const brandName = opt(h.brand) ?? supplier.name;
    const status = (opt(h.status) ?? "CONFIRMED").toUpperCase();
    if (!["DRAFT", "SENT", "CONFIRMED"].includes(status)) throw new Error(`PO ${key}: status must be DRAFT, SENT or CONFIRMED`);
    const orderDate = opt(h.order_date) ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) throw new Error(`PO ${key}: order_date must be YYYY-MM-DD`);
    const items = lines.map((l, i) => {
      const qty = Math.round(num(l.qty));
      const unitPrice = num(l.unit_price);
      if (!l.sku || qty <= 0) throw new Error(`PO ${key} line ${i + 1}: sku and a positive qty are required`);
      return { sku: l.sku.toUpperCase(), name: opt(l.product_name) ?? l.sku, qty, unitPrice, discountPct: num(l.discount_pct), taxPct: num(l.tax_pct) };
    });
    const total = poTotal(items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice, discountPct: i.discountPct, taxPct: i.taxPct })));
    const paidAmount = lines.reduce((s, l) => s + num(l.paid_amount), 0);
    if (dry) {
      out.push(`${opt(h.po_number) ?? "(new)"} ${supplier.name} ${items.length} lines $${total}`);
      continue;
    }
    await db.$transaction(async (tx) => {
      const brand = await tx.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName } });
      let number = opt(h.po_number);
      if (!number) {
        const rows = await tx.$queryRaw<{ max: number | null }[]>`SELECT MAX(CAST(substring("number" from '-(\\d+)$') AS INTEGER)) AS max FROM "PurchaseOrder"`;
        number = `${supplier.code}-${(rows[0]?.max ?? 26000) + 1}`;
      }
      if (await tx.purchaseOrder.findUnique({ where: { number } })) throw new Error(`PO ${number} already exists`);
      const productIds: string[] = [];
      for (const it of items) {
        const p = (await tx.product.findUnique({ where: { sku: it.sku } })) ?? (await tx.product.create({ data: { sku: it.sku, name: it.name, brandId: brand.id, category: "Uncategorized" } }));
        productIds.push(p.id);
      }
      const eta = opt(h.eta);
      const terms = opt(h.payment_terms) ?? supplier.paymentTerms;
      const po = await tx.purchaseOrder.create({
        data: {
          number, supplierId: supplier.id, brandId: brand.id, currency: supplier.currency, orderDate: fromIsoDate(orderDate), paymentTerms: terms,
          incoterm: supplier.incoterm, eta: eta ? fromIsoDate(eta) : null, poStatus: status as "DRAFT" | "SENT" | "CONFIRMED",
          sentAt: status === "DRAFT" ? null : fromIsoDate(orderDate), confirmedAt: status === "CONFIRMED" ? fromIsoDate(orderDate) : null,
          items: { create: items.map((it, i) => ({ productId: productIds[i], qtyOrdered: it.qty, unitPrice: it.unitPrice, discountPct: it.discountPct, taxPct: it.taxPct })) },
        },
      });
      let left = paidAmount;
      for (const s of defaultSchedule(terms, total, orderDate, eta ? addDays(eta, -5) : null, addDays)) {
        const pay = Math.min(left, s.amount);
        left -= pay;
        if (pay > 0 && pay < s.amount - 0.005) {
          await tx.payment.create({ data: { poId: po.id, type: s.type, amount: pay, dueDate: fromIsoDate(s.dueDate), paidDate: fromIsoDate(orderDate), method: "Bank transfer (TT)", notes: "Imported" } });
          await tx.payment.create({ data: { poId: po.id, type: s.type, amount: Math.round((s.amount - pay) * 100) / 100, dueDate: fromIsoDate(s.dueDate) } });
        } else {
          await tx.payment.create({ data: { poId: po.id, type: s.type, amount: s.amount, dueDate: fromIsoDate(s.dueDate), paidDate: pay > 0 ? fromIsoDate(orderDate) : null, method: pay > 0 ? "Bank transfer (TT)" : null, notes: pay > 0 ? "Imported" : null } });
        }
      }
      await tx.activityLog.create({ data: { poId: po.id, actorLabel: "Import", kind: "SYSTEM", text: `Imported from ${path.basename(process.argv[3])} (${items.length} lines, $${total}).` } });
      await recalcPo(tx, po.id, today);
      out.push(`${number} ${supplier.name} ${items.length} lines $${total}`);
    });
    touchedSuppliers.add(supplier.id);
  }
  if (!dry) {
    for (const id of touchedSuppliers) await refreshSupplierStats(db, id);
    await syncNotifications(db, today, new Date());
  }
  return `${groups.size} purchase orders ${dry ? "checked" : "imported"}:\n  ${out.join("\n  ")}`;
}

async function main() {
  const [kind, file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry-run");
  if (!kind || !file) {
    console.log("Usage: npm run import -- <suppliers|products|pos> <file.csv|file.xlsx> [--dry-run]");
    process.exit(1);
  }
  const rows = await readRows(file);
  const msg = kind === "suppliers" ? await importSuppliers(rows, dry) : kind === "products" ? await importProducts(rows, dry) : kind === "pos" ? await importPos(rows, dry) : null;
  if (!msg) throw new Error(`Unknown import type "${kind}". Use suppliers, products or pos.`);
  console.log((dry ? "[dry run] " : "") + msg);
}

main()
  .catch((e) => {
    console.error("Import failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
