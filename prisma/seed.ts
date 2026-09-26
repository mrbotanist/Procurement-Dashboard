// Seed data ported from design/prototype/fpv-data-v2.js, plus this year's closed-order history
// so spend, budgets and supplier performance have something to show.
// The sample is written for 2026-09-26 ("today" in the prototype). Every date is shifted by
// (real today − 2026-09-26) so the demo looks the same whenever you seed it.
// Run: npm run db:seed   (WIPES and reloads every table)

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type {
  CustomsDocumentStatus,
  CustomsDocumentType,
  CustomsStatus,
  DocumentType,
  InventoryStatus,
  PaymentStatus,
  PoStatus,
  ProductionStatus,
  Role,
  ShipmentMilestone,
  ShipmentStatus,
} from "../src/generated/prisma/enums";
import { addDays, daysBetween, fromIsoDate, todayIso, type IsoDate } from "../src/lib/dates";
import { customsCosts } from "../src/lib/domain/customs";
import { defaultSchedule } from "../src/lib/domain/payments";
import { poTotal } from "../src/lib/domain/totals";
import { syncNotifications } from "../src/server/jobs/notifications";
import { recalcPo, refreshSupplierStats } from "../src/server/recalc";

/** "Today" the sample data was written for. */
const TODAY: IsoDate = "2026-09-26";
const REAL_TODAY = todayIso();
const SHIFT = daysBetween(TODAY, REAL_TODAY);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
/** Sample date → stored date, shifted to the real calendar. */
const D = (s: IsoDate) => fromIsoDate(addDays(s, SHIFT));
const min = (a: IsoDate, b: IsoDate) => (a < b ? a : b);
const users = new Map<Role, string>();

// ─── Users ───────────────────────────────────────────────────────────────────

const USERS: [string, string, Role][] = [
  ["Aisha Rahman", "admin@fpvstore.ae", "ADMIN"],
  ["Rashid Khan", "rashid.khan@fpvstore.ae", "PROCUREMENT_MANAGER"],
  ["Priya Nair", "finance@fpvstore.ae", "FINANCE"],
  ["Omar Haddad", "warehouse@fpvstore.ae", "WAREHOUSE"],
  ["Sara Al Mansoori", "management@fpvstore.ae", "MANAGEMENT"],
];

// ─── Suppliers ───────────────────────────────────────────────────────────────
// name, code, city, country, contact, email, phone, web, terms, incoterm, place, leadDays, onTime%

const SUPPLIERS: [string, string, string, string, string, string, string, string, string, string, string, number, number][] = [
  ["GEPRC", "GE", "Shenzhen", "China", "Lily Zhang", "sales@geprc.com", "+86 755 2330 1180", "geprc.com", "50% deposit, 50% before shipment", "EXW", "Shenzhen", 16, 94],
  ["T-Motor", "TM", "Nanchang", "China", "Kevin Liu", "fpv@tmotor.com", "+86 791 8820 4411", "tmotor.com", "30% deposit, 70% before shipment", "FCA", "Nanchang", 21, 88],
  ["Caddx", "CD", "Shenzhen", "China", "Amy Chen", "b2b@caddxfpv.com", "+86 755 8651 2290", "caddxfpv.com", "100% before shipment", "EXW", "Shenzhen", 12, 97],
  ["iFlight", "IF", "Shenzhen", "China", "Jason Wu", "dealer@iflight.com", "+86 755 2381 9921", "iflight.com", "50% deposit, 50% before shipment", "EXW", "Shenzhen", 19, 79],
  ["Foxeer", "FX", "Shenzhen", "China", "Sunny He", "sales@foxeer.com", "+86 755 2896 3310", "foxeer.com", "100% before shipment", "EXW", "Shenzhen", 14, 92],
  ["RadioMaster", "RC", "Shenzhen", "China", "Tom Huang", "dealers@radiomasterrc.com", "+86 755 2305 7731", "radiomasterrc.com", "50% deposit, balance in 10 days", "EXW", "Shenzhen", 18, 85],
  ["HGLRC", "HG", "Shenzhen", "China", "Grace Lin", "sales@hglrc.com", "+86 755 2801 6632", "hglrc.com", "100% before shipment", "EXW", "Shenzhen", 13, 93],
  ["BetaFPV", "BF", "Shenzhen", "China", "Leo Zhou", "distributor@betafpv.com", "+86 755 2663 0917", "betafpv.com", "100% before shipment", "EXW", "Shenzhen", 15, 90],
  ["DJI", "DJ", "Shenzhen", "China", "Enterprise Desk", "dealers@dji.com", "+86 755 2665 6677", "dji.com", "100% on order", "CIP", "Dubai", 10, 98],
  ["SpeedyBee", "SP", "Shenzhen", "China", "Bella Xu", "b2b@speedybee.com", "+86 755 2336 5802", "speedybee.com", "100% before shipment", "EXW", "Shenzhen", 14, 91],
  ["TBS", "TB", "Hong Kong", "Hong Kong", "Marco Ng", "dealers@team-blacksheep.com", "+852 3001 4480", "team-blacksheep.com", "50% deposit, 50% before shipment", "EXW", "Hong Kong", 17, 89],
  ["Axisflying", "AX", "Dongguan", "China", "Ryan Deng", "sales@axisflying.com", "+86 769 2231 5540", "axisflying.com", "100% on order", "EXW", "Dongguan", 20, 76],
];

// ─── Brand budgets (USD, 2026) ───────────────────────────────────────────────

const BUDGETS: [string, number][] = [
  ["GEPRC", 136_000], ["DJI", 109_000], ["iFlight", 76_000], ["T-Motor", 82_000],
  ["Caddx", 68_000], ["RadioMaster", 60_000], ["Team BlackSheep", 45_000], ["SpeedyBee", 40_000],
];

// ─── Products ────────────────────────────────────────────────────────────────
// sku, name, brand, category, stock, units sold per day, usual unit price.
// Stock and sales rates for the 8 SKUs on the prototype's inventory screen are taken from it;
// the rest are illustrative.

const PRODUCTS: [string, string, string, string, number, number, number][] = [
  ["GE-2207-1750", "GEPRC 2207 Motor", "GEPRC", "Motors", 32, 4, 12],
  ["GE-5PROP", "Propeller", "GEPRC", "Propellers", 640, 12, 2.45],
  ["TM-F60P-2207", "T-Motor F60 Pro V 2207 Motor", "T-Motor", "Motors", 48, 1.2, 21],
  ["CD-WALNUT-4K", "Caddx Walnut 4K Camera", "Caddx", "Cameras", 11, 0.8, 110],
  ["CD-ANT-LITE", "Caddx Ant Lite Camera", "Caddx", "Cameras", 85, 1.5, 10],
  ["IF-XING2-2207", "iFlight XING2 2207 Motor", "iFlight", "Motors", 120, 2, 17],
  ["IF-BLITZ-E55", "iFlight BLITZ E55 ESC", "iFlight", "ESCs", 14, 0.3, 50],
  ["FX-RAZER-MINI", "Foxeer Razer Mini Camera", "Foxeer", "Cameras", 26, 1.2, 19],
  ["FX-LOLLI4", "Foxeer Lollipop 4 Antenna", "Foxeer", "Antennas", 210, 3, 3.1],
  ["RM-BOXER-ELRS", "RadioMaster Boxer ELRS", "RadioMaster", "Radios", 3, 0.4, 139],
  ["RM-RP1", "RadioMaster RP1 ELRS Receiver", "RadioMaster", "Receivers", 64, 1.1, 13],
  ["HG-ZEUS-F722", "HGLRC Zeus F722 Flight Controller", "HGLRC", "Flight Controllers", 14, 0.6, 59],
  ["BF-CETUS-X", "BetaFPV Cetus X Kit", "BetaFPV", "Kits", 12, 0.3, 132.5],
  ["DJI-O4-AIR", "DJI O4 Air Unit", "DJI", "Digital FPV", 4, 1, 189],
  ["SB-F405-V4", "SpeedyBee F405 V4 Stack", "SpeedyBee", "Flight Controllers", 9, 0.9, 51.5],
  ["TBS-CRSF-NANO", "TBS Crossfire Nano RX", "Team BlackSheep", "Receivers", 58, 1, 23.9],
  ["TBS-UNIFY-PRO32", "TBS Unify Pro32 VTX", "Team BlackSheep", "Video Transmitters", 37, 0.7, 27],
  ["AX-VIMANA-2207", "Vimana 2207 Motor", "Axisflying", "Motors", 18, 1.5, 5.96],
];

// ─── Closed orders this year (history) ───────────────────────────────────────
// Totals are spread so monthly spend follows the prototype's chart
// (Jan $39K … Aug $66K) and brand totals follow its budget bars.

/** brand, number of closed POs, share of the year's closed spend */
const HISTORY_BRANDS: [string, number, number][] = [
  ["GEPRC", 7, 104], ["DJI", 6, 85], ["iFlight", 5, 64], ["T-Motor", 4, 54], ["Caddx", 3, 47], ["RadioMaster", 3, 38],
  ["Team BlackSheep", 2, 27], ["SpeedyBee", 2, 22], ["Foxeer", 1, 15], ["HGLRC", 1, 10], ["BetaFPV", 1, 12], ["Axisflying", 1, 12],
];
/** month (1–12), number of closed POs, spend target for those POs (USD) */
const HISTORY_MONTHS: [number, number, number][] = [
  [1, 4, 39_000], [2, 4, 46_000], [3, 4, 53_000], [4, 4, 48_000], [5, 5, 57_000], [6, 5, 51_000], [7, 5, 61_000], [8, 5, 50_000],
];

// ─── Purchase orders ─────────────────────────────────────────────────────────

interface SeedPo {
  number: string;
  supplier: string;
  brand: string;
  date: IsoDate;
  po: PoStatus;
  pay: PaymentStatus;
  depDue?: IsoDate;
  balDue?: IsoDate;
  prod: ProductionStatus;
  ship: ShipmentStatus;
  customs: CustomsStatus;
  inv: InventoryStatus;
  eta: IsoDate | null;
  /** Timeline step reached in the prototype (1 = Created … 7 = Received). */
  tl: number;
  pct: number;
  carrier: string;
  tracking?: string;
  /** Overrides date+13 for expected production completion. */
  prodDue?: IsoDate;
  items: [sku: string, qty: number, unitPrice: number][];
}

const POS: SeedPo[] = [
  { number: "GE-26091", supplier: "GEPRC", brand: "GEPRC", date: "2026-09-18", po: "CONFIRMED", pay: "PARTIALLY_PAID", balDue: "2026-09-28", prod: "IN_PRODUCTION", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-04", tl: 4, pct: 80, carrier: "DHL Express", prodDue: "2026-10-01", items: [["GE-2207-1750", 500, 12], ["GE-5PROP", 1000, 2.45]] },
  { number: "TM-26092", supplier: "T-Motor", brand: "T-Motor", date: "2026-09-22", po: "SENT", pay: "PENDING", depDue: "2026-09-27", prod: "NOT_STARTED", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: null, tl: 1, pct: 0, carrier: "FedEx", items: [["TM-F60P-2207", 200, 21]] },
  { number: "CD-26093", supplier: "Caddx", brand: "Caddx", date: "2026-09-02", po: "CONFIRMED", pay: "PAID", prod: "COMPLETED", ship: "IN_TRANSIT", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-09-28", tl: 6, pct: 100, carrier: "DHL Express", tracking: "4829 1057 36", items: [["CD-WALNUT-4K", 80, 110], ["CD-ANT-LITE", 400, 10]] },
  { number: "IF-26094", supplier: "iFlight", brand: "iFlight", date: "2026-08-28", po: "CONFIRMED", pay: "PAID", prod: "DELAYED", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-12", tl: 4, pct: 65, carrier: "DHL Express", items: [["IF-XING2-2207", 300, 17], ["IF-BLITZ-E55", 20, 50]] },
  { number: "FX-26095", supplier: "Foxeer", brand: "Foxeer", date: "2026-08-30", po: "CONFIRMED", pay: "PAID", prod: "COMPLETED", ship: "IN_TRANSIT", customs: "DOCUMENTS_REQUIRED", inv: "NOT_RECEIVED", eta: "2026-09-29", tl: 6, pct: 100, carrier: "FedEx", tracking: "7731 4402 9186", items: [["FX-RAZER-MINI", 150, 19], ["FX-LOLLI4", 300, 3.1]] },
  { number: "RC-26096", supplier: "RadioMaster", brand: "RadioMaster", date: "2026-09-10", po: "CONFIRMED", pay: "OVERDUE", balDue: "2026-09-20", prod: "DELAYED", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-15", tl: 4, pct: 40, carrier: "Aramex", items: [["RM-BOXER-ELRS", 60, 139], ["RM-RP1", 100, 13]] },
  { number: "HG-26097", supplier: "HGLRC", brand: "HGLRC", date: "2026-09-05", po: "CONFIRMED", pay: "PAID", prod: "COMPLETED", ship: "IN_TRANSIT", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-02", tl: 6, pct: 100, carrier: "Aramex", tracking: "3390 1184 552", items: [["HG-ZEUS-F722", 50, 59]] },
  { number: "BF-26098", supplier: "BetaFPV", brand: "BetaFPV", date: "2026-09-24", po: "SENT", pay: "PENDING", depDue: "2026-10-01", prod: "NOT_STARTED", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-20", tl: 1, pct: 0, carrier: "DHL Express", items: [["BF-CETUS-X", 40, 132.5]] },
  { number: "DJ-26099", supplier: "DJI", brand: "DJI", date: "2026-09-12", po: "CONFIRMED", pay: "PAID", prod: "COMPLETED", ship: "SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-12", tl: 5, pct: 100, carrier: "Emirates SkyCargo", tracking: "AWB 176-48213095", items: [["DJI-O4-AIR", 100, 189]] },
  { number: "SP-26100", supplier: "SpeedyBee", brand: "SpeedyBee", date: "2026-09-15", po: "CONFIRMED", pay: "PAID", prod: "IN_PRODUCTION", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-09", tl: 4, pct: 70, carrier: "DHL Express", prodDue: "2026-09-30", items: [["SB-F405-V4", 80, 51.5]] },
  { number: "TB-26101", supplier: "TBS", brand: "Team BlackSheep", date: "2026-09-08", po: "CONFIRMED", pay: "PARTIALLY_PAID", balDue: "2026-10-03", prod: "READY", ship: "READY_TO_SHIP", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-06", tl: 4, pct: 100, carrier: "DHL Express", items: [["TBS-CRSF-NANO", 200, 23.9], ["TBS-UNIFY-PRO32", 100, 27]] },
  { number: "AX-26088", supplier: "Axisflying", brand: "Axisflying", date: "2026-08-25", po: "CONFIRMED", pay: "PAID", prod: "DELAYED", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-08", tl: 4, pct: 75, carrier: "DHL Express", items: [["AX-VIMANA-2207", 1000, 5.96]] },
];

const PRODUCTION_NOTES: Record<string, string> = {
  "GE-26091": "Motors wound and balanced. Propellers in final molding run. Packing scheduled for Sep 30, production expected to finish October 1.",
  "IF-26094": "ESC board shortage at assembly partner. Revised completion date to be confirmed by Sep 29.",
  "RC-26096": "Production paused pending balance payment. Gimbals and housings are ready.",
  "AX-26088": "Magnet supply delayed one week. 750 of 1,000 motors complete.",
};

const MILESTONES: ShipmentMilestone[] = ["SUPPLIER", "PICKED_UP", "EXPORT_CUSTOMS", "IN_TRANSIT", "IMPORT_CUSTOMS", "DELIVERED"];
const CUSTOMS_DOCS: [CustomsDocumentType, string][] = [
  ["COMMERCIAL_INVOICE", "Commercial invoice"],
  ["PACKING_LIST", "Packing list"],
  ["CERTIFICATE_OF_ORIGIN", "Certificate of origin"],
  ["IMPORT_DOCUMENTS", "Import documents"],
  ["CUSTOMS_DECLARATION", "Customs declaration"],
];

// ─── Seed ────────────────────────────────────────────────────────────────────

async function wipe() {
  // Children first.
  await db.notification.deleteMany();
  await db.activityLog.deleteMany();
  await db.customsDocument.deleteMany();
  await db.customsCost.deleteMany();
  await db.shipmentMilestoneEvent.deleteMany();
  await db.payment.deleteMany();
  await db.document.deleteMany();
  await db.shipment.deleteMany();
  await db.pOItem.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.product.deleteMany();
  await db.brandBudget.deleteMany();
  await db.brand.deleteMany();
  await db.supplier.deleteMany();
  await db.user.deleteMany();
}

// ─── History ─────────────────────────────────────────────────────────────────

interface SeedMaps {
  suppliers: Map<string, { id: string; origin: string; terms: string }>;
  brands: Map<string, string>;
  products: Map<string, { id: string; name: string }>;
  pm: string;
}

const BRAND_SUPPLIER: Record<string, string> = { "Team BlackSheep": "TBS" };

async function seedHistory({ suppliers, brands, products, pm }: SeedMaps) {
  // 1. Build the list of closed POs: brand + target value.
  const totalTarget = HISTORY_MONTHS.reduce((s, m) => s + m[2], 0);
  const weightSum = HISTORY_BRANDS.reduce((s, b) => s + b[2], 0);
  const orders: { brand: string; target: number }[] = [];
  for (const [brand, count, weight] of HISTORY_BRANDS) {
    const brandTotal = (totalTarget * weight) / weightSum;
    for (let i = 0; i < count; i++) orders.push({ brand, target: (brandTotal / count) * (0.85 + ((i * 7) % 5) * 0.075) });
  }

  // 2. Assign to months: biggest orders first, into the month with the most target left.
  const months = HISTORY_MONTHS.map(([month, slots, target]) => ({ month, slots, left: target, orders: [] as typeof orders }));
  for (const o of [...orders].sort((a, b) => b.target - a.target)) {
    const m = months.filter((x) => x.orders.length < x.slots).sort((a, b) => b.left - a.left)[0];
    m.orders.push(o);
    m.left -= o.target;
  }

  // 3. Create them.
  let seq = 25_001;
  const perSupplier = new Map<string, number>();
  for (const m of months) {
    for (const [k, o] of m.orders.entries()) {
      const supplierName = BRAND_SUPPLIER[o.brand] ?? o.brand;
      const sup = suppliers.get(supplierName)!;
      const sRow = SUPPLIERS.find((s) => s[0] === supplierName)!;
      const [code, lead, onTimePct] = [sRow[1], sRow[11], sRow[12]];
      const nth = perSupplier.get(supplierName) ?? 0;
      perSupplier.set(supplierName, nth + 1);

      const skus = PRODUCTS.filter((p) => p[2] === o.brand);
      const lines = (skus.length > 1 && nth % 2 === 0 ? skus.slice(0, 2) : [skus[nth % skus.length]]).map((p, i, arr) => {
        const share = arr.length > 1 ? (i === 0 ? 0.7 : 0.3) : 1;
        return { sku: p[0], unitPrice: p[6], qty: Math.max(1, Math.round((o.target * share) / p[6] / 10) * 10) };
      });
      const total = poTotal(lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })));

      const orderDate = `2026-${String(m.month).padStart(2, "0")}-${String(3 + k * 6).padStart(2, "0")}`;
      const eta = addDays(orderDate, lead);
      // Late in roughly (100 − on-time%) of this supplier's orders; at least one when below 90%.
      const n = HISTORY_BRANDS.find((b) => b[0] === o.brand)![1];
      const lateCount = Math.max(onTimePct < 90 ? 1 : 0, Math.round((n * (100 - onTimePct)) / 100));
      const late = nth >= n - lateCount;
      const arrived = addDays(eta, late ? 2 + (nth % 4) : -(nth % 2));
      const shipDate = addDays(orderDate, Math.max(3, lead - 5));
      const number = `${code}-${seq++}`;

      const po = await db.purchaseOrder.create({
        data: {
          number, supplierId: sup.id, brandId: brands.get(o.brand)!, orderDate: D(orderDate), paymentTerms: sup.terms,
          incoterm: sRow[9], plannedCarrier: "DHL Express", expectedProductionDate: D(addDays(shipDate, -2)), expectedShipDate: D(shipDate),
          eta: D(eta), productionStartedAt: D(addDays(orderDate, 2)), productionCompletedAt: D(addDays(shipDate, -1)), productionProgressPct: 100,
          productionNote: "Goods completed and quality-checked by supplier.", sentAt: D(orderDate), confirmedAt: D(addDays(orderDate, 1)),
          closedAt: D(addDays(arrived, 2)), poStatus: "CLOSED", paymentStatus: "PAID", productionStatus: "COMPLETED", shipmentStatus: "DELIVERED",
          customsStatus: "CLEARED", inventoryStatus: "STOCKED", createdById: pm, createdAt: D(orderDate),
          items: { create: lines.map((l) => ({ productId: products.get(l.sku)!.id, qtyOrdered: l.qty, qtyReceived: l.qty, unitPrice: l.unitPrice })) },
        },
      });
      for (const [i, p] of defaultSchedule(sup.terms, total, orderDate, shipDate, addDays).entries()) {
        await db.payment.create({
          data: { poId: po.id, type: p.type, amount: p.amount, dueDate: D(p.dueDate), paidDate: D(p.dueDate), method: "Bank transfer (TT)", bankReference: `ENBD-${number.replace("-", "")}-${i + 1}` },
        });
      }
      const shipment = await db.shipment.create({
        data: {
          poId: po.id, carrier: "DHL Express", trackingNumber: `${1000 + seq} ${String(seq * 7919).slice(0, 4)} ${String(seq).slice(-2)}`, origin: sup.origin,
          shipDate: D(shipDate), eta: D(eta), actualArrival: D(arrived), shippingCost: Math.round(total * 0.045), milestone: "DELIVERED",
        },
      });
      const span = Math.max(1, daysBetween(shipDate, arrived));
      for (const [i, milestone] of MILESTONES.entries()) {
        await db.shipmentMilestoneEvent.create({ data: { shipmentId: shipment.id, milestone, occurredAt: D(addDays(shipDate, Math.round((span * i) / 5))) } });
      }
      for (const [type] of CUSTOMS_DOCS) await db.customsDocument.create({ data: { shipmentId: shipment.id, type, status: "RECEIVED" } });
      const cc = customsCosts(total);
      await db.customsCost.create({
        data: { shipmentId: shipment.id, duty: Math.round(cc.duty), importVat: Math.round(cc.importVat), clearanceCharges: cc.clearanceCharges },
      });
      for (const [type, fileName, date] of [
        ["PURCHASE_ORDER", `${number.toLowerCase()}.pdf`, orderDate],
        ["COMMERCIAL_INVOICE", `CI-${number}.pdf`, shipDate],
      ] as const) {
        await db.document.create({
          data: { poId: po.id, supplierId: sup.id, shipmentId: type === "COMMERCIAL_INVOICE" ? shipment.id : undefined, type, fileName, storageKey: `seed/${number}/${fileName}`, mimeType: "application/pdf", uploadedById: pm, createdAt: D(date) },
        });
      }
      await db.activityLog.createMany({
        data: [
          { poId: po.id, userId: pm, actorLabel: "Rashid Khan", kind: "NOTE", text: `Purchase order sent to ${supplierName}.`, createdAt: D(orderDate) },
          { poId: po.id, userId: users.get("WAREHOUSE"), actorLabel: "Omar Haddad", kind: "STATUS_CHANGE", text: "All items received and stocked. PO closed.", createdAt: D(addDays(arrived, 2)) },
        ],
      });
    }
  }
}

async function main() {
  await wipe();

  const password = process.env.SEED_PASSWORD || "procurement";
  const passwordHash = await bcrypt.hash(password, 10);
  for (const [name, email, role] of USERS) {
    const u = await db.user.create({ data: { name, email, role, passwordHash } });
    users.set(role, u.id);
  }
  const pm = users.get("PROCUREMENT_MANAGER")!;

  const suppliers = new Map<string, { id: string; origin: string; terms: string }>();
  for (const [name, code, city, country, contactName, email, phone, website, paymentTerms, incoterm, incotermPlace, , onTime] of SUPPLIERS) {
    const notes = onTime < 85
      ? "On-time rate below 85% this year. Ask for weekly production photos on open orders."
      : "Reliable on lead times. Confirm firmware version on each batch before dispatch.";
    const s = await db.supplier.create({
      data: { name, code, city, country, contactName, email, phone, website, paymentTerms, incoterm, incotermPlace, notes, createdAt: D("2023-03-01") },
    });
    const slug = name.toLowerCase().replace(/[^a-z]/g, "");
    for (const [title, fileName, date, type] of [
      ["Distributor agreement 2026", `agreement-${slug}-2026.pdf`, "2026-01-08", "OTHER"],
      ["Price list Q3", `pricelist-${slug}-q3.xlsx`, "2026-07-02", "QUOTATION"],
      ["Bank details (verified)", `bank-${slug}.pdf`, "2026-03-14", "CORRESPONDENCE"],
      ["Product certifications", `ce-fcc-${slug}.pdf`, "2026-02-20", "OTHER"],
    ] as const) {
      await db.document.create({
        data: {
          supplierId: s.id, type, title, fileName, storageKey: `seed/${code}/${fileName}`, createdAt: D(date),
          mimeType: fileName.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
        },
      });
    }
    suppliers.set(name, { id: s.id, origin: city === country ? city : `${city}, ${country}`, terms: paymentTerms });
  }

  const brandNames = new Set([...PRODUCTS.map((p) => p[2]), ...BUDGETS.map((b) => b[0])]);
  const brands = new Map<string, string>();
  for (const name of brandNames) brands.set(name, (await db.brand.create({ data: { name } })).id);
  for (const [brand, amountUsd] of BUDGETS) {
    await db.brandBudget.create({ data: { brandId: brands.get(brand)!, year: 2026, amountUsd } });
  }

  const products = new Map<string, { id: string; name: string }>();
  for (const [sku, name, brand, category, stockQty, dailySalesRate] of PRODUCTS) {
    const p = await db.product.create({ data: { sku, name, brandId: brands.get(brand)!, category, stockQty, dailySalesRate } });
    products.set(sku, { id: p.id, name });
  }

  await seedHistory({ suppliers, brands, products, pm });

  for (const p of POS) {
    const sup = suppliers.get(p.supplier)!;
    const value = p.items.reduce((s, [, q, u]) => s + q * u, 0);
    const half = Math.round((value / 2) * 100) / 100;
    const depDue = p.depDue ?? addDays(p.date, 1);
    const balDue = p.balDue ?? addDays(p.date, 10);
    const reachedProduction = p.tl >= 4;
    const prodDue = p.po === "SENT" ? null : (p.prodDue ?? addDays(p.date, 13));
    const prodDone = p.prod === "COMPLETED" || p.prod === "READY";

    // Shipment progress as in the prototype's detail(): index into MILESTONES + 1.
    const shipIdx = { NOT_SHIPPED: 0, READY_TO_SHIP: 1, SHIPPED: 2, IN_TRANSIT: 4, DELIVERED: 6 }[p.ship];
    const reached = p.customs === "DOCUMENTS_REQUIRED" ? 5 : shipIdx;
    const shipDate = reached >= 2 ? min(addDays(p.date, 15), addDays(TODAY, -1)) : null;

    // Payments: 50% deposit + 50% balance, as in the prototype.
    const depositPaid = p.pay !== "PENDING";
    const balancePaid = p.pay === "PAID";
    const ref = (n: number) => `ENBD-${p.number.replace("-", "")}-${n}`;

    // Customs checklist: done / missing / pending per document.
    const ck: CustomsDocumentStatus[] =
      p.customs === "DOCUMENTS_REQUIRED" ? ["RECEIVED", "RECEIVED", "MISSING", "RECEIVED", "PENDING"]
      : p.customs === "IN_CLEARANCE" ? ["RECEIVED", "RECEIVED", "RECEIVED", "RECEIVED", "PENDING"]
      : p.customs === "CLEARED" ? ["RECEIVED", "RECEIVED", "RECEIVED", "RECEIVED", "RECEIVED"]
      : reached >= 2 ? ["RECEIVED", "RECEIVED", "PENDING", "PENDING", "PENDING"]
      : ["PENDING", "PENDING", "PENDING", "PENDING", "PENDING"];

    const po = await db.purchaseOrder.create({
      data: {
        number: p.number,
        supplierId: sup.id,
        brandId: brands.get(p.brand)!,
        orderDate: D(p.date),
        paymentTerms: sup.terms,
        incoterm: SUPPLIERS.find((s) => s[0] === p.supplier)![9],
        plannedCarrier: p.carrier,
        expectedProductionDate: prodDue ? D(prodDue) : null,
        expectedShipDate: prodDue ? D(addDays(prodDue, 2)) : null,
        eta: p.eta ? D(p.eta) : null,
        productionStartedAt: reachedProduction ? D(addDays(p.date, 3)) : null,
        productionCompletedAt: prodDone ? D(addDays(p.date, 12)) : null,
        productionProgressPct: p.pct,
        productionNote:
          PRODUCTION_NOTES[p.number] ??
          (p.prod === "NOT_STARTED" ? "Production starts after supplier confirmation and deposit."
            : p.prod === "IN_PRODUCTION" ? "On schedule per latest supplier update."
            : "Goods completed and quality-checked by supplier."),
        lastSupplierUpdateAt: reachedProduction ? D("2026-09-25") : null,
        sentAt: D(p.date),
        confirmedAt: p.po === "CONFIRMED" ? D(addDays(p.date, 1)) : null,
        poStatus: p.po,
        paymentStatus: p.pay,
        productionStatus: p.prod,
        shipmentStatus: p.ship,
        customsStatus: p.customs,
        inventoryStatus: p.inv,
        createdById: pm,
        createdAt: D(p.date),
        items: {
          create: p.items.map(([sku, qtyOrdered, unitPrice]) => ({ productId: products.get(sku)!.id, qtyOrdered, unitPrice })),
        },
      },
    });

    // Documents
    const low = p.number.toLowerCase();
    const doc = (type: DocumentType, fileName: string, date: IsoDate, shipmentId?: string) =>
      db.document.create({
        data: {
          poId: po.id, supplierId: sup.id, shipmentId, type, fileName,
          storageKey: `seed/${p.number}/${fileName}`,
          mimeType: fileName.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
          size: 0, uploadedById: pm, createdAt: D(date),
        },
      });
    await doc("QUOTATION", `quotation-${low}.pdf`, addDays(p.date, -3));
    if (p.po === "CONFIRMED") await doc("PROFORMA_INVOICE", `PI-${p.number}.pdf`, addDays(p.date, 1));
    await doc("PURCHASE_ORDER", `${low}.pdf`, p.date);
    const receipt = depositPaid ? await doc("PAYMENT_RECEIPT", `deposit-receipt-${low}.pdf`, addDays(p.date, 1)) : null;

    await db.payment.create({
      data: {
        poId: po.id, type: "DEPOSIT", amount: half, dueDate: D(depDue),
        paidDate: depositPaid ? D(depDue) : null,
        method: "Bank transfer (TT)", bankReference: depositPaid ? ref(1) : null,
        receiptDocumentId: receipt?.id,
      },
    });
    await db.payment.create({
      data: {
        poId: po.id, type: "BALANCE", amount: value - half, dueDate: D(balDue),
        paidDate: balancePaid ? D(balDue) : null,
        method: "Bank transfer (TT)", bankReference: balancePaid ? ref(2) : null,
      },
    });

    // Shipment, once goods are ready or moving.
    if (p.ship !== "NOT_SHIPPED") {
      const shipment = await db.shipment.create({
        data: {
          poId: po.id, carrier: p.carrier, trackingNumber: p.tracking, origin: sup.origin,
          shipDate: shipDate ? D(shipDate) : null, eta: p.eta ? D(p.eta) : null,
          shippingCost: reached >= 2 ? Math.round(value * 0.045) : null,
          milestone: MILESTONES[Math.max(0, reached - 1)],
        },
      });
      for (let i = 0; i < reached && i < MILESTONES.length; i++) {
        await db.shipmentMilestoneEvent.create({
          data: { shipmentId: shipment.id, milestone: MILESTONES[i], occurredAt: D(min(addDays(p.date, 14 + i), TODAY)) },
        });
      }
      for (let i = 0; i < CUSTOMS_DOCS.length; i++) {
        await db.customsDocument.create({ data: { shipmentId: shipment.id, type: CUSTOMS_DOCS[i][0], status: ck[i] } });
      }
      if (shipDate) {
        await doc("COMMERCIAL_INVOICE", `CI-${p.number}.pdf`, shipDate, shipment.id);
        await doc("PACKING_LIST", `PL-${p.number}.xlsx`, shipDate, shipment.id);
        await doc("AIR_WAYBILL", `AWB-${p.number}.pdf`, shipDate, shipment.id);
      }
    }

    // Activity log (newest first in the UI).
    const log = (date: IsoDate, actorLabel: string, text: string, userId?: string) =>
      db.activityLog.create({ data: { poId: po.id, userId, actorLabel, text, kind: "NOTE", createdAt: D(date) } });
    if (p.number === "GE-26091") {
      await log("2026-09-19", "Supplier", "PO confirmed. Deposit invoice issued.");
      await log("2026-09-20", "Rashid Khan", "Payment confirmation sent.", pm);
      await log("2026-09-25", "Rashid Khan", "Requested updated production status.", pm);
      await log("2026-09-25", "Supplier", "Production expected to finish October 1.");
    } else {
      await log(p.date, "Rashid Khan", `Purchase order sent to ${p.supplier}.`, pm);
      await log(
        addDays(p.date, reachedProduction ? 7 : 1),
        "Supplier",
        p.po === "SENT" ? "Received PO, reviewing quantities and lead time." : PRODUCTION_NOTES[p.number] ?? "On schedule per latest supplier update.",
      );
    }
  }

  // Derived fields and notifications come from the same code the app uses.
  const today = REAL_TODAY;
  const now = new Date();
  for (const { id } of await db.purchaseOrder.findMany({ select: { id: true } })) await recalcPo(db, id, today);
  for (const { id } of suppliers.values()) await refreshSupplierStats(db, id);
  const { created } = await syncNotifications(db, today, now);
  // Spread the rule notifications over the last few hours so the list reads naturally.
  const rows = await db.notification.findMany({ orderBy: [{ tone: "asc" }, { title: "asc" }], select: { id: true } });
  for (const [i, { id }] of rows.entries()) {
    await db.notification.update({ where: { id }, data: { createdAt: new Date(now.getTime() - (i + 1) * 47 * 60_000) } });
  }
  // A supplier update (event, not a rule).
  const ge = await db.purchaseOrder.findUniqueOrThrow({ where: { number: "GE-26091" } });
  await db.notification.create({
    data: {
      tone: "BLUE", kind: "Update", title: "GEPRC posted an update on PO #GE-26091", detail: "Production expected to finish October 1.",
      poId: ge.id, dedupeKey: "seed:update:GE-26091", createdAt: new Date(D("2026-09-25").getTime() + 10 * 3_600_000),
    },
  });

  const closed = HISTORY_BRANDS.reduce((n, b) => n + b[1], 0);
  console.log(`Seeded ${USERS.length} users, ${SUPPLIERS.length} suppliers, ${PRODUCTS.length} products, ${POS.length} open + ${closed} closed purchase orders, ${created + 1} notifications.`);
  if (SHIFT) console.log(`Sample dates shifted by ${SHIFT} days to match today (${REAL_TODAY}).`);
  console.log(`Sign in with any seeded email (e.g. rashid.khan@fpvstore.ae) and password "${password}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
