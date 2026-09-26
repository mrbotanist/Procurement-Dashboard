import { currentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { todayIso } from "@/lib/dates";
import { poLabels } from "@/lib/status";
import { listOrders, parseOrderParams } from "@/server/queries/orders";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || !can(user.role, "view:orders")) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const params = parseOrderParams(Object.fromEntries(url.searchParams));
  const today = todayIso();
  const { rows } = await listOrders(params, today);
  const header = ["PO Number", "Supplier", "Brand", "Order Date", "Currency", "Total", "Paid", "Outstanding", "PO Status", "Payment", "Production", "Shipment", "Customs", "Inventory", "ETA", "Health", "Reason", "Units", "Carrier", "Tracking"];
  const lines = rows.map((p) => {
    const l = poLabels(p);
    return [p.number, p.supplier.name, p.brand.name, p.orderDate, p.currency, p.total.toFixed(2), p.paid.toFixed(2), p.outstanding.toFixed(2), l.po, l.pay, l.prod, l.ship, l.customs, l.inv, p.eta ?? "", l.health, p.healthReason, p.units, p.carrier ?? "", p.trackingNumber ?? ""];
  });
  const csv = [header, ...lines].map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-orders-${today}.csv"`,
    },
  });
}
