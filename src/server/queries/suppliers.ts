import "server-only";
import { db } from "@/lib/db";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { compareByHealth } from "@/lib/domain/orders";
import { countsAsSpend, isOpenPo, origin, poSummaries, yearRange, type PoSummary } from "./pos";

export interface SupplierStats {
  openOrders: number;
  outstanding: number;
  ordersYtd: number;
  valueYtd: number;
  unitsYtd: number;
  issues: PoSummary[];
  worst: PoSummary | null;
}

function stats(pos: PoSummary[], year: number): SupplierStats {
  const open = pos.filter((p) => isOpenPo(p) && p.poStatus !== "DRAFT");
  const ytd = pos.filter((p) => countsAsSpend(p) && p.orderDate.startsWith(String(year)));
  const issues = open.filter((p) => p.health !== "ON_TRACK").sort(compareByHealth);
  return {
    openOrders: open.length,
    outstanding: open.reduce((s, p) => s + p.outstanding, 0),
    ordersYtd: ytd.length,
    valueYtd: ytd.reduce((s, p) => s + p.total, 0),
    unitsYtd: ytd.reduce((s, p) => s + p.units, 0),
    issues,
    worst: issues[0] ?? null,
  };
}

export async function listSuppliers(today: IsoDate) {
  const year = Number(today.slice(0, 4));
  const [suppliers, pos] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    poSummaries({ OR: [{ orderDate: yearRange(year) }, { poStatus: { notIn: ["CLOSED", "CANCELLED"] } }] }, today),
  ]);
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    contactName: s.contactName,
    paymentTerms: s.paymentTerms,
    leadTimeDays: s.leadTimeDays,
    onTimeRate: s.onTimeRate == null ? null : Number(s.onTimeRate),
    ...stats(pos.filter((p) => p.supplier.id === s.id), year),
  }));
}

export async function getSupplier(id: string, today: IsoDate) {
  const year = Number(today.slice(0, 4));
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: { documents: { where: { poId: null }, orderBy: { createdAt: "desc" } } },
  });
  if (!supplier) return null;
  const pos = await poSummaries({ supplierId: id }, today);
  const s = stats(pos, year);
  const months = Array.from({ length: Number(today.slice(5, 7)) }, (_, i) => i + 1);
  const history = months.map((m) => {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    return { month: m, value: pos.filter((p) => countsAsSpend(p) && p.orderDate.startsWith(key)).reduce((a, p) => a + p.total, 0) };
  });
  const lastYear = pos.filter((p) => countsAsSpend(p) && p.orderDate.startsWith(String(year - 1))).reduce((a, p) => a + p.total, 0);
  return {
    supplier: { ...supplier, origin: origin(supplier), onTimeRate: supplier.onTimeRate == null ? null : Number(supplier.onTimeRate) },
    stats: s,
    current: pos.filter((p) => isOpenPo(p)).sort(compareByHealth),
    history,
    lastYear,
    documents: supplier.documents.map((d) => ({ id: d.id, type: d.type, title: d.title, fileName: d.fileName, date: toIsoDate(d.createdAt) })),
  };
}
