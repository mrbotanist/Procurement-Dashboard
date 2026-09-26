import "server-only";
import { db } from "@/lib/db";
import { addDays, type IsoDate } from "@/lib/dates";
import { compareByHealth, matchesFilter, QUICK_FILTERS, STAGES, type OrderFilter, type Stage } from "@/lib/domain/orders";
import { poSummaries, type PoSummary } from "./pos";

export interface OrderParams {
  f: OrderFilter;
  scope: "open" | "closed" | "all";
  stage?: Stage;
  q?: string;
  supplier?: string;
  brand?: string;
  pay?: string;
  ship?: string;
  date?: string;
  currency?: string;
}

const FILTERS: OrderFilter[] = [...QUICK_FILTERS.map((q) => q.key), "production", "customs", "open", "closed"];
const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseOrderParams(sp: Record<string, string | string[] | undefined>): OrderParams {
  const f = str(sp.f) as OrderFilter | undefined;
  const scope = str(sp.scope);
  const stage = str(sp.stage) as Stage | undefined;
  return {
    f: f && FILTERS.includes(f) ? f : "all",
    scope: scope === "closed" || scope === "all" ? scope : stage === "Closed" ? "closed" : "open",
    stage: stage && (STAGES as readonly string[]).includes(stage) ? stage : undefined,
    q: str(sp.q),
    supplier: str(sp.supplier),
    brand: str(sp.brand),
    pay: str(sp.pay),
    ship: str(sp.ship),
    date: str(sp.date),
    currency: str(sp.currency),
  };
}

function inScope(p: PoSummary, scope: OrderParams["scope"]) {
  if (scope === "all") return true;
  const open = p.poStatus !== "CLOSED" && p.poStatus !== "CANCELLED";
  return scope === "open" ? open : !open;
}

function dateOk(p: PoSummary, date: string | undefined, today: IsoDate) {
  if (!date) return true;
  if (date === "30d") return p.orderDate >= addDays(today, -30);
  if (date === "90d") return p.orderDate >= addDays(today, -90);
  if (/^\d{4}$/.test(date)) return p.orderDate.startsWith(date);
  if (/^\d{4}-\d{2}$/.test(date)) return p.orderDate.startsWith(date);
  return true;
}

/** PO ids whose invoice/quotation files match the search text. */
async function docMatches(q: string) {
  const docs = await db.document.findMany({
    where: { fileName: { contains: q, mode: "insensitive" }, poId: { not: null } },
    select: { poId: true },
  });
  return new Set(docs.map((d) => d.poId!));
}

function textOk(p: PoSummary, q: string | undefined, docIds: Set<string>) {
  if (!q) return true;
  const hay = [p.number, p.supplier.name, p.brand.name, p.trackingNumber ?? "", ...p.items.flatMap((i) => [i.sku, i.name])].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase()) || docIds.has(p.id);
}

export async function listOrders(params: OrderParams, today: IsoDate) {
  const all = await poSummaries({}, today);
  const docIds = params.q ? await docMatches(params.q) : new Set<string>();
  const scoped = all.filter((p) => inScope(p, params.scope)).sort(compareByHealth);
  const facetOk = (p: PoSummary) =>
    (!params.supplier || p.supplier.id === params.supplier) &&
    (!params.brand || p.brand.id === params.brand) &&
    (!params.pay || p.paymentStatus === params.pay) &&
    (!params.ship || p.shipmentStatus === params.ship) &&
    (!params.currency || p.currency === params.currency) &&
    (!params.stage || p.stage === params.stage) &&
    dateOk(p, params.date, today) &&
    textOk(p, params.q, docIds);
  const rows = scoped.filter((p) => matchesFilter(p, params.f) && facetOk(p));
  const counts = Object.fromEntries(QUICK_FILTERS.map((q) => [q.key, scoped.filter((p) => matchesFilter(p, q.key)).length])) as Record<string, number>;
  const openCount = all.filter((p) => inScope(p, "open")).length;
  const uniq = <T,>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];
  return {
    rows,
    counts,
    total: scoped.length,
    openCount,
    suppliers: uniq(all.map((p) => p.supplier), (s) => s.id).sort((a, b) => a.name.localeCompare(b.name)),
    brands: uniq(all.map((p) => p.brand), (b) => b.id).sort((a, b) => a.name.localeCompare(b.name)),
    currencies: [...new Set(all.map((p) => p.currency))].sort(),
    months: [...new Set(all.map((p) => p.orderDate.slice(0, 7)))].sort().reverse(),
  };
}
