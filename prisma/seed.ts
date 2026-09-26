// Seed data ported from design/prototype/fpv-data-v2.js.
// The sample data is anchored on 2026-09-26 ("today" in the prototype).
// Run: npm run db:seed   (wipes and reloads every table)

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
  NotificationTone,
  PaymentStatus,
  PoStatus,
  ProductionStatus,
  Role,
  ShipmentMilestone,
  ShipmentStatus,
} from "../src/generated/prisma/enums";
import { addDays, fromIsoDate, type IsoDate } from "../src/lib/dates";
import { computeHealth } from "../src/lib/domain/health";

const TODAY: IsoDate = "2026-09-26";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const D = fromIsoDate;
const min = (a: IsoDate, b: IsoDate) => (a < b ? a : b);

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
// sku, name, brand, category, stock, units sold per day.
// Stock and sales rates for the 8 SKUs on the prototype's inventory screen are taken from it;
// the rest are illustrative.

const PRODUCTS: [string, string, string, string, number, number][] = [
  ["GE-2207-1750", "GEPRC 2207 Motor", "GEPRC", "Motors", 32, 4],
  ["GE-5PROP", "Propeller", "GEPRC", "Propellers", 640, 12],
  ["TM-F60P-2207", "T-Motor F60 Pro V 2207 Motor", "T-Motor", "Motors", 48, 1.2],
  ["CD-WALNUT-4K", "Caddx Walnut 4K Camera", "Caddx", "Cameras", 11, 0.8],
  ["CD-ANT-LITE", "Caddx Ant Lite Camera", "Caddx", "Cameras", 85, 1.5],
  ["IF-XING2-2207", "iFlight XING2 2207 Motor", "iFlight", "Motors", 120, 2],
  ["IF-BLITZ-E55", "iFlight BLITZ E55 ESC", "iFlight", "ESCs", 14, 0.3],
  ["FX-RAZER-MINI", "Foxeer Razer Mini Camera", "Foxeer", "Cameras", 26, 1.2],
  ["FX-LOLLI4", "Foxeer Lollipop 4 Antenna", "Foxeer", "Antennas", 210, 3],
  ["RM-BOXER-ELRS", "RadioMaster Boxer ELRS", "RadioMaster", "Radios", 3, 0.4],
  ["RM-RP1", "RadioMaster RP1 ELRS Receiver", "RadioMaster", "Receivers", 64, 1.1],
  ["HG-ZEUS-F722", "HGLRC Zeus F722 Flight Controller", "HGLRC", "Flight Controllers", 14, 0.6],
  ["BF-CETUS-X", "BetaFPV Cetus X Kit", "BetaFPV", "Kits", 12, 0.3],
  ["DJI-O4-AIR", "DJI O4 Air Unit", "DJI", "Digital FPV", 4, 1],
  ["SB-F405-V4", "SpeedyBee F405 V4 Stack", "SpeedyBee", "Flight Controllers", 9, 0.9],
  ["TBS-CRSF-NANO", "TBS Crossfire Nano RX", "Team BlackSheep", "Receivers", 58, 1],
  ["TBS-UNIFY-PRO32", "TBS Unify Pro32 VTX", "Team BlackSheep", "Video Transmitters", 37, 0.7],
  ["AX-VIMANA-2207", "Vimana 2207 Motor", "Axisflying", "Motors", 18, 1.5],
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
  { number: "BF-26098", supplier: "BetaFPV", brand: "BetaFPV", date: "2026-09-24", po: "SENT", pay: "PENDING", prod: "NOT_STARTED", ship: "NOT_SHIPPED", customs: "NOT_STARTED", inv: "NOT_RECEIVED", eta: "2026-10-20", tl: 1, pct: 0, carrier: "DHL Express", items: [["BF-CETUS-X", 40, 132.5]] },
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

// ─── Notifications ───────────────────────────────────────────────────────────
// tone, kind, title, detail, po, hours ago

const NOTIFS: [NotificationTone, string, string, string, string, number][] = [
  ["RED", "Delay", "PO #IF-26094 is delayed", "Production past expected date. Supplier to confirm revised date by Sep 29.", "IF-26094", 2],
  ["RED", "Payment", "Payment for PO #RC-26096 is overdue", "Balance of $4,820 was due Sep 20. Supplier has paused production.", "RC-26096", 6],
  ["RED", "Delay", "PO #AX-26088 is delayed", "Magnet supply delayed one week. 750 of 1,000 motors complete.", "AX-26088", 26],
  ["ORANGE", "Payment", "Payment for PO #TM-26092 is due tomorrow", "Deposit of $2,100 due Sep 27.", "TM-26092", 3],
  ["ORANGE", "Confirmation", "Supplier confirmation pending for PO #BF-26098", "PO sent Sep 24. No response yet.", "BF-26098", 4],
  ["ORANGE", "Customs", "Customs documents required for PO #FX-26095", "Certificate of Origin missing. Shipment lands Sep 29.", "FX-26095", 5],
  ["ORANGE", "Payment", "GEPRC balance due in 2 days", "Balance of $4,225 due Sep 28 before dispatch.", "GE-26091", 7],
  ["BLUE", "Shipment", "Shipment #CD-26093 is arriving in 2 days", "DHL Express · 4829 1057 36", "CD-26093", 28],
  ["BLUE", "Update", "GEPRC posted an update on PO #GE-26091", "Production expected to finish October 1.", "GE-26091", 30],
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

async function main() {
  await wipe();

  const password = process.env.SEED_PASSWORD || "procurement";
  const passwordHash = await bcrypt.hash(password, 10);
  const users = new Map<Role, string>();
  for (const [name, email, role] of USERS) {
    const u = await db.user.create({ data: { name, email, role, passwordHash } });
    users.set(role, u.id);
  }
  const pm = users.get("PROCUREMENT_MANAGER")!;

  const suppliers = new Map<string, { id: string; origin: string; terms: string }>();
  for (const [name, code, city, country, contactName, email, phone, website, paymentTerms, incoterm, incotermPlace, leadTimeDays, onTime] of SUPPLIERS) {
    const s = await db.supplier.create({
      data: { name, code, city, country, contactName, email, phone, website, paymentTerms, incoterm, incotermPlace, leadTimeDays, onTimeRate: onTime },
    });
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
    const missingIdx = ck.indexOf("MISSING");

    const { health, reason } = computeHealth(
      {
        poStatus: p.po,
        paymentStatus: p.pay,
        productionStatus: p.prod,
        customsStatus: p.customs,
        eta: p.eta,
        overdueSince: p.pay === "OVERDUE" ? balDue : null,
        nextDueDate: p.pay === "PARTIALLY_PAID" ? balDue : p.pay === "PENDING" ? depDue : null,
        missingCustomsDoc: missingIdx >= 0 ? CUSTOMS_DOCS[missingIdx][1] : null,
      },
      TODAY,
    );

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
        health,
        healthReason: reason,
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

  const poIds = new Map((await db.purchaseOrder.findMany({ select: { id: true, number: true } })).map((p) => [p.number, p.id]));
  const now = new Date(D(TODAY).getTime() + 12 * 3_600_000); // Sep 26, 12:00 UTC
  for (const [tone, kind, title, detail, number, hoursAgo] of NOTIFS) {
    await db.notification.create({
      data: {
        tone, kind, title, detail, poId: poIds.get(number),
        dedupeKey: `seed:${kind}:${number}:${title}`,
        createdAt: new Date(now.getTime() - hoursAgo * 3_600_000),
      },
    });
  }

  console.log(`Seeded ${USERS.length} users, ${SUPPLIERS.length} suppliers, ${PRODUCTS.length} products, ${POS.length} purchase orders.`);
  console.log(`Sign in with any seeded email (e.g. rashid.khan@fpvstore.ae) and password "${password}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
