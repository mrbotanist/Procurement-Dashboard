import "server-only";
import { db } from "@/lib/db";
import { addDays, daysBetween, toIsoDate, type IsoDate } from "@/lib/dates";
import { budgetSummary } from "@/lib/domain/budget";
import { calendarEvents, compareEvents, type CalendarEvent } from "@/lib/domain/calendar";
import { firstMissingDoc } from "@/lib/domain/customs";
import { compareByHealth, isOpen, matchesFilter, STAGES, type Stage } from "@/lib/domain/orders";
import { stockoutRisk, type StockoutResult } from "@/lib/domain/stockout";
import { MON } from "@/lib/format";
import { brandSpend } from "./budgets";
import { countsAsSpend, poSummaries, yearRange, type PoSummary } from "./pos";

// ─── Date range (header segment) ─────────────────────────────────────────────

export type RangeKey = "30d" | "quarter" | "ytd";

export function rangeBounds(range: string | undefined, today: IsoDate): { key: RangeKey; from: IsoDate; to: IsoDate; label: string } {
  const y = today.slice(0, 4);
  if (range === "30d") return { key: "30d", from: addDays(today, -30), to: today, label: "Last 30 days" };
  if (range === "quarter") {
    const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
    return { key: "quarter", from: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: today, label: `Q${q + 1} ${y}` };
  }
  return { key: "ytd", from: `${y}-01-01`, to: today, label: `Year to date` };
}

const inRange = (d: IsoDate, from: IsoDate, to: IsoDate) => d >= from && d <= to;

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryRow extends StockoutResult {
  productId: string;
  sku: string;
  name: string;
  brand: string;
  stock: number;
  rate: number;
  incoming: number;
  eta: IsoDate | null;
  poNumber: string | null;
}

export async function inventoryRows(today: IsoDate): Promise<InventoryRow[]> {
  const [products, open] = await Promise.all([
    db.product.findMany({ include: { brand: { select: { name: true } } } }),
    db.pOItem.findMany({
      where: { po: { poStatus: { in: ["SENT", "CONFIRMED"] } } },
      select: {
        productId: true, qtyOrdered: true, qtyReceived: true,
        po: { select: { number: true, eta: true, shipments: { orderBy: { createdAt: "desc" }, take: 1, select: { eta: true } } } },
      },
    }),
  ]);
  const incoming = new Map<string, { qty: number; eta: IsoDate | null; po: string }>();
  for (const i of open) {
    const left = i.qtyOrdered - i.qtyReceived;
    if (left <= 0) continue;
    const eta = toIsoDate(i.po.shipments[0]?.eta ?? i.po.eta);
    const cur = incoming.get(i.productId);
    if (!cur) incoming.set(i.productId, { qty: left, eta, po: i.po.number });
    else {
      cur.qty += left;
      if (eta && (!cur.eta || eta < cur.eta)) {
        cur.eta = eta;
        cur.po = i.po.number;
      }
    }
  }
  const order = { risk: 0, warn: 1, ok: 2 };
  return products
    .map((p) => {
      const inc = incoming.get(p.id);
      const rate = Number(p.dailySalesRate);
      return {
        productId: p.id, sku: p.sku, name: p.name, brand: p.brand.name, stock: p.stockQty, rate,
        incoming: inc?.qty ?? 0, eta: inc?.eta ?? null, poNumber: inc?.po ?? null,
        ...stockoutRisk(p.stockQty, rate, inc?.eta ?? null, today),
      };
    })
    .sort((a, b) => order[a.level] - order[b.level] || (a.coverDays ?? 1e9) - (b.coverDays ?? 1e9));
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export async function eventsBetween(from: IsoDate, to: IsoDate): Promise<CalendarEvent[]> {
  const pos = await db.purchaseOrder.findMany({
    where: {
      poStatus: { not: "CANCELLED" },
      OR: [{ poStatus: { not: "CLOSED" } }, { closedAt: { gte: new Date(from + "T00:00:00Z") } }, { orderDate: { gte: new Date(addDays(from, -120) + "T00:00:00Z") } }],
    },
    select: {
      number: true, eta: true, expectedProductionDate: true, productionStatus: true, customsStatus: true,
      supplier: { select: { name: true } },
      payments: { select: { type: true, dueDate: true, paidDate: true } },
      shipments: { select: { shipDate: true, eta: true, actualArrival: true, customsDocuments: { select: { type: true, status: true } } } },
    },
  });
  return pos
    .flatMap((p) =>
      calendarEvents({
        number: p.number,
        supplier: p.supplier.name,
        expectedProductionDate: toIsoDate(p.expectedProductionDate),
        productionDone: p.productionStatus === "COMPLETED" || p.productionStatus === "READY",
        eta: toIsoDate(p.eta),
        customsStatus: p.customsStatus,
        missingCustomsDoc: firstMissingDoc(p.shipments.flatMap((s) => s.customsDocuments)),
        payments: p.payments.map((x) => ({ type: x.type, dueDate: toIsoDate(x.dueDate), paidDate: toIsoDate(x.paidDate) })),
        shipments: p.shipments.map((s) => ({ shipDate: toIsoDate(s.shipDate), eta: toIsoDate(s.eta), actualArrival: toIsoDate(s.actualArrival) })),
      }),
    )
    .filter((e) => inRange(e.date, from, to))
    .sort(compareEvents);
}

// ─── Spend helpers ───────────────────────────────────────────────────────────

export function monthlySpend(pos: PoSummary[], year: number, throughMonth: number) {
  return Array.from({ length: throughMonth }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { month: i + 1, label: MON[i], value: pos.filter((p) => countsAsSpend(p) && p.orderDate.startsWith(key)).reduce((s, p) => s + p.total, 0) };
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function dashboard(today: IsoDate, range: string | undefined) {
  const year = Number(today.slice(0, 4));
  const r = rangeBounds(range, today);
  const [all, inventory, events, budgets, spend] = await Promise.all([
    poSummaries({ OR: [{ orderDate: yearRange(year) }, { poStatus: { notIn: ["CLOSED", "CANCELLED"] } }, { orderDate: { gte: new Date(r.from + "T00:00:00Z") } }] }, today),
    inventoryRows(today),
    eventsBetween(today, addDays(today, 10)),
    db.brandBudget.findMany({ where: { year }, include: { brand: true } }),
    brandSpend(year, today),
  ]);
  const open = all.filter((p) => isOpen(p)).sort(compareByHealth);
  const f = (key: Parameters<typeof matchesFilter>[1]) => open.filter((p) => matchesFilter(p, key));
  const rangeSpend = all.filter((p) => countsAsSpend(p) && inRange(p.orderDate, r.from, r.to)).reduce((s, p) => s + p.total, 0);
  const closedThisYear = all.filter((p) => p.poStatus === "CLOSED" && p.orderDate.startsWith(String(year)));
  const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const p of open) if (p.stage) stageCounts[p.stage]++;
  stageCounts.Closed = closedThisYear.length;
  const months = monthlySpend(all, year, Number(today.slice(5, 7)));
  const cur = months.at(-1)!;
  const prev = months.at(-2);

  return {
    range: r,
    kpis: {
      open: open.filter((p) => p.poStatus !== "DRAFT").length,
      drafts: open.filter((p) => p.poStatus === "DRAFT").length,
      paymentPending: f("payment"),
      production: f("production"),
      transit: f("transit"),
      delayed: f("delayed"),
      spend: rangeSpend,
    },
    actions: { delayed: f("delayed"), payment: f("payment"), unconfirmed: f("unconfirmed"), customs: f("customs") },
    stages: stageCounts,
    openCount: open.length,
    closedCount: closedThisYear.length,
    active: open.slice(0, 8),
    events,
    months,
    ytd: months.reduce((s, m) => s + m.value, 0),
    monthChange: prev && prev.value ? (cur.value - prev.value) / prev.value : null,
    budgets: budgets
      .map((b) => ({ brandId: b.brandId, brand: b.brand.name, ...budgetSummary({ budget: Number(b.amountUsd), ...(spend.byBrand.get(b.brandId) ?? { purchased: 0, committed: 0 }) }) }))
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 5),
    inventory: inventory.filter((i) => i.incoming > 0).slice(0, 5),
    worstStock: inventory.find((i) => i.level === "risk" && i.incoming > 0) ?? inventory.find((i) => i.level === "risk") ?? null,
  };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function analytics(today: IsoDate, range: string | undefined) {
  const r = rangeBounds(range, today);
  const year = Number(today.slice(0, 4));
  const [pos, suppliers, prevPeriod] = await Promise.all([
    poSummaries({ orderDate: { gte: new Date(`${year}-01-01T00:00:00Z`) } }, today),
    db.supplier.findMany({ select: { id: true, name: true, country: true, leadTimeDays: true } }),
    poSummaries({ orderDate: { gte: new Date(addDays(r.from, -366) + "T00:00:00Z"), lte: new Date(addDays(r.to, -365) + "T00:00:00Z") } }, today),
  ]);
  const inPeriod = pos.filter((p) => countsAsSpend(p) && inRange(p.orderDate, r.from, r.to));
  const total = inPeriod.reduce((s, p) => s + p.total, 0);
  const lastYear = prevPeriod.filter((p) => countsAsSpend(p) && inRange(p.orderDate, addDays(r.from, -365), addDays(r.to, -365))).reduce((s, p) => s + p.total, 0);
  const month = today.slice(0, 7);
  const thisMonth = pos.filter((p) => countsAsSpend(p) && p.orderDate.startsWith(month)).reduce((s, p) => s + p.total, 0);
  const sum = <K extends string>(key: (p: PoSummary) => K) => {
    const m = new Map<K, number>();
    for (const p of inPeriod) m.set(key(p), (m.get(key(p)) ?? 0) + p.total);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byCategory = new Map<string, number>();
  const byProduct = new Map<string, { sku: string; name: string; units: number; spend: number; pos: number }>();
  for (const p of inPeriod) {
    for (const i of p.items) {
      byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.total);
      const x = byProduct.get(i.productId) ?? { sku: i.sku, name: i.name, units: 0, spend: 0, pos: 0 };
      x.units += i.qty;
      x.spend += i.total;
      x.pos += 1;
      byProduct.set(i.productId, x);
    }
  }
  const status = {
    pre: inPeriod.filter((p) => p.poStatus === "SENT" || (p.poStatus === "CONFIRMED" && p.productionStatus === "NOT_STARTED")).length,
    production: inPeriod.filter((p) => p.poStatus === "CONFIRMED" && p.shipmentStatus === "NOT_SHIPPED" && p.productionStatus !== "NOT_STARTED").length,
    shipping: inPeriod.filter((p) => p.poStatus === "CONFIRMED" && p.shipmentStatus !== "NOT_SHIPPED" && p.inventoryStatus === "NOT_RECEIVED").length,
  };
  const done = inPeriod.length - status.pre - status.production - status.shipping;
  const countryOf = new Map(suppliers.map((s) => [s.id, s.country]));
  const byCountry = new Map<string, { value: number; suppliers: Set<string> }>();
  for (const p of inPeriod) {
    const c = countryOf.get(p.supplier.id) ?? "—";
    const x = byCountry.get(c) ?? { value: 0, suppliers: new Set() };
    x.value += p.total;
    x.suppliers.add(p.supplier.id);
    byCountry.set(c, x);
  }
  const leads = suppliers.filter((s) => s.leadTimeDays != null);
  return {
    range: r,
    total,
    changeVsLastYear: lastYear ? (total - lastYear) / lastYear : null,
    thisMonth,
    count: inPeriod.length,
    open: inPeriod.filter((p) => isOpen(p)).length,
    closed: inPeriod.filter((p) => p.poStatus === "CLOSED").length,
    avgPo: inPeriod.length ? total / inPeriod.length : 0,
    avgLead: leads.length ? leads.reduce((s, x) => s + x.leadTimeDays!, 0) / leads.length : null,
    delayed: pos.filter((p) => p.health === "DELAYED" && isOpen(p)).length,
    months: monthlySpend(pos, year, Number(today.slice(5, 7))),
    status: [
      { k: "Pre-production", v: status.pre },
      { k: "In production", v: status.production },
      { k: "Shipping & customs", v: status.shipping },
      { k: "Received / closed", v: done },
    ],
    bySupplier: sum((p) => p.supplier.name),
    byBrand: sum((p) => p.brand.name),
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    byCountry: [...byCountry.entries()].map(([k, v]) => ({ k, value: v.value, suppliers: v.suppliers.size })).sort((a, b) => b.value - a.value),
    lead: leads.map((s) => ({ name: s.name, days: s.leadTimeDays! })).sort((a, b) => b.days - a.days),
    products: [...byProduct.values()].sort((a, b) => b.spend - a.spend),
    daysInRange: daysBetween(r.from, r.to) + 1,
  };
}
