import { describe, expect, it } from "vitest";
import { addDays } from "../../dates";
import { budgetBucket, budgetCheck, budgetSummary } from "../budget";
import { calendarEvents, compareEvents } from "../calendar";
import { customsCosts, deriveCustomsStatus, firstMissingDoc } from "../customs";
import { notificationsFor, type NotificationPoInput } from "../notifications";
import { compareByHealth, matchesFilter, poStage, type StatusSet } from "../orders";
import { defaultSchedule, derivePaymentState } from "../payments";
import { deriveProductionStatus } from "../production";
import { stockoutRisk } from "../stockout";
import { supplierPerformance } from "../suppliers";
import { lineTotal, poTotal, poUnits } from "../totals";

const TODAY = "2026-09-26";

describe("totals", () => {
  it("GE-26091: 500 × $12 + 1,000 × $2.45 = $8,450", () => {
    expect(poTotal([{ qty: 500, unitPrice: 12 }, { qty: 1000, unitPrice: 2.45 }])).toBe(8450);
  });
  it("applies discount then tax", () => {
    expect(lineTotal({ qty: 10, unitPrice: 100, discountPct: 10, taxPct: 5 })).toBe(945);
  });
  it("rounds to cents", () => {
    expect(lineTotal({ qty: 3, unitPrice: 0.333 })).toBe(1);
    expect(poUnits([{ qty: 500 }, { qty: 1000 }])).toBe(1500);
  });
});

describe("derivePaymentState", () => {
  const dep = (paid: boolean) => ({ amount: 4820, dueDate: "2026-09-11", paidDate: paid ? "2026-09-11" : null });
  it("RC-26096: deposit paid, balance due Sep 20 unpaid → OVERDUE since Sep 20", () => {
    const s = derivePaymentState([dep(true), { amount: 4820, dueDate: "2026-09-20", paidDate: null }], 9640, TODAY);
    expect(s).toMatchObject({ status: "OVERDUE", paid: 4820, outstanding: 4820, overdueSince: "2026-09-20" });
  });
  it("GE-26091: deposit paid, balance due Sep 28 → PARTIALLY_PAID, next due Sep 28", () => {
    const s = derivePaymentState([{ amount: 4225, dueDate: "2026-09-19", paidDate: "2026-09-19" }, { amount: 4225, dueDate: "2026-09-28", paidDate: null }], 8450, TODAY);
    expect(s).toMatchObject({ status: "PARTIALLY_PAID", nextDueDate: "2026-09-28", overdueSince: null });
  });
  it("nothing paid and nothing due yet → PENDING", () => {
    expect(derivePaymentState([{ amount: 2100, dueDate: "2026-09-27", paidDate: null }], 4200, TODAY).status).toBe("PENDING");
  });
  it("nothing paid and a due date passed → OVERDUE, labelled by payment type", () => {
    const s = derivePaymentState([{ amount: 2100, dueDate: "2026-09-25", paidDate: null, type: "DEPOSIT" }], 4200, TODAY);
    expect(s.status).toBe("OVERDUE");
    expect(s.overdueLabel).toBe("Deposit");
  });
  it("due today is not overdue", () => {
    expect(derivePaymentState([{ amount: 2100, dueDate: TODAY, paidDate: null }], 4200, TODAY).status).toBe("PENDING");
  });
  it("paid ≥ total → PAID even with an old unpaid row", () => {
    const s = derivePaymentState([{ amount: 100, dueDate: "2026-09-01", paidDate: "2026-09-01" }, { amount: 5, dueDate: "2026-09-02", paidDate: null }], 100, TODAY);
    expect(s).toMatchObject({ status: "PAID", overdueSince: null, outstanding: 0 });
  });
  it("no payment rows → PENDING", () => {
    expect(derivePaymentState([], 500, TODAY).status).toBe("PENDING");
  });
});

describe("defaultSchedule", () => {
  it("50/50 deposit and balance before shipment", () => {
    expect(defaultSchedule("50% deposit, 50% before shipment", 1000, "2026-10-01", "2026-10-20", addDays)).toEqual([
      { type: "DEPOSIT", amount: 500, dueDate: "2026-10-02" },
      { type: "BALANCE", amount: 500, dueDate: "2026-10-18" },
    ]);
  });
  it("30/70", () => {
    expect(defaultSchedule("30% deposit, 70% before shipment", 1000, "2026-10-01", null, addDays).map((p) => p.amount)).toEqual([300, 700]);
  });
  it("balance in N days", () => {
    expect(defaultSchedule("50% deposit, balance in 10 days", 1000, "2026-10-01", null, addDays)[1].dueDate).toBe("2026-10-11");
  });
  it("100% on order → one payment next day", () => {
    expect(defaultSchedule("100% on order", 1000, "2026-10-01", "2026-10-20", addDays)).toEqual([{ type: "BALANCE", amount: 1000, dueDate: "2026-10-02" }]);
  });
  it("100% before shipment", () => {
    expect(defaultSchedule("100% before shipment", 1000, "2026-10-01", "2026-10-20", addDays)[0].dueDate).toBe("2026-10-18");
  });
});

describe("deriveProductionStatus", () => {
  it("IF-26094: past expected date and not done → DELAYED", () => {
    expect(deriveProductionStatus("IN_PRODUCTION", "2026-09-10", TODAY)).toBe("DELAYED");
    expect(deriveProductionStatus("NOT_STARTED", "2026-09-10", TODAY)).toBe("DELAYED");
  });
  it("on the expected date is not late", () => {
    expect(deriveProductionStatus("IN_PRODUCTION", TODAY, TODAY)).toBe("IN_PRODUCTION");
  });
  it("done or no date → unchanged", () => {
    expect(deriveProductionStatus("COMPLETED", "2026-09-10", TODAY)).toBe("COMPLETED");
    expect(deriveProductionStatus("READY", "2026-09-10", TODAY)).toBe("READY");
    expect(deriveProductionStatus("IN_PRODUCTION", null, TODAY)).toBe("IN_PRODUCTION");
  });
});

describe("customs", () => {
  const fx = [
    { type: "COMMERCIAL_INVOICE" as const, status: "RECEIVED" as const },
    { type: "CERTIFICATE_OF_ORIGIN" as const, status: "MISSING" as const },
    { type: "CUSTOMS_DECLARATION" as const, status: "PENDING" as const },
  ];
  it("FX-26095: names the missing certificate of origin", () => {
    expect(firstMissingDoc(fx)).toBe("Certificate of origin");
    expect(firstMissingDoc([])).toBeNull();
  });
  it("missing doc → DOCUMENTS_REQUIRED; resolved → next state", () => {
    expect(deriveCustomsStatus("NOT_STARTED", fx, false)).toBe("DOCUMENTS_REQUIRED");
    expect(deriveCustomsStatus("DOCUMENTS_REQUIRED", [{ status: "RECEIVED" }], true)).toBe("IN_CLEARANCE");
    expect(deriveCustomsStatus("DOCUMENTS_REQUIRED", [{ status: "RECEIVED" }], false)).toBe("NOT_STARTED");
    expect(deriveCustomsStatus("IN_CLEARANCE", [{ status: "RECEIVED" }], true)).toBe("IN_CLEARANCE");
  });
  it("ON_HOLD and CLEARED are sticky", () => {
    expect(deriveCustomsStatus("ON_HOLD", fx, true)).toBe("ON_HOLD");
    expect(deriveCustomsStatus("CLEARED", fx, true)).toBe("CLEARED");
  });
  it("GE-26091 estimate: $423 duty, $444 VAT, $95 clearance, $961 total", () => {
    const c = customsCosts(8450);
    expect(Math.round(c.duty)).toBe(423);
    expect(Math.round(c.importVat)).toBe(444);
    expect(c.clearanceCharges).toBe(95);
    expect(Math.round(c.total)).toBe(961);
    expect(c.estimated).toBe(true);
  });
  it("uses actual values once entered", () => {
    expect(customsCosts(8450, { duty: 400, importVat: 420, clearanceCharges: 80 })).toEqual({ duty: 400, importVat: 420, clearanceCharges: 80, total: 900, estimated: false });
  });
});

describe("stockoutRisk (prototype inventory rows)", () => {
  it("DJI O4: 4 in stock, 1/day, ETA Oct 12 → risk, Sep 30, 12 days before", () => {
    expect(stockoutRisk(4, 1, "2026-10-12", TODAY)).toMatchObject({ coverDays: 4, stockoutDate: "2026-09-30", level: "risk", label: "Stockout risk", reason: "Stockout ~Sep 30, 12 days before arrival" });
  });
  it("RadioMaster Boxer: 3 @ 0.4/day, ETA Oct 15 → risk Oct 3", () => {
    expect(stockoutRisk(3, 0.4, "2026-10-15", TODAY)).toMatchObject({ coverDays: 7, reason: "Stockout ~Oct 3, 12 days before arrival" });
  });
  it("GEPRC motor: 32 @ 4/day, ETA Oct 4 → tight (cover ends Oct 4)", () => {
    expect(stockoutRisk(32, 4, "2026-10-04", TODAY)).toMatchObject({ level: "warn", label: "Tight", reason: "Tight: cover ends Oct 4" });
  });
  it("Vimana: 18 @ 1.5/day, ETA Oct 8 → tight (gap 0)", () => {
    expect(stockoutRisk(18, 1.5, "2026-10-08", TODAY).level).toBe("warn");
  });
  it("Foxeer Razer: 26 @ 1.2/day, ETA Sep 29 → covered", () => {
    expect(stockoutRisk(26, 1.2, "2026-09-29", TODAY)).toMatchObject({ level: "ok", label: "Covered", reason: "Covered until arrival" });
  });
  it("gap of exactly −3 is covered", () => {
    expect(stockoutRisk(10, 1, "2026-10-03", TODAY).level).toBe("ok"); // out Oct 6, ETA Oct 3
  });
  it("no sales → covered; nothing incoming uses a 2-week horizon", () => {
    expect(stockoutRisk(5, 0, "2026-10-01", TODAY).level).toBe("ok");
    expect(stockoutRisk(3, 1, null, TODAY).level).toBe("risk");
    expect(stockoutRisk(10, 1, null, TODAY).level).toBe("warn");
    expect(stockoutRisk(30, 1, null, TODAY).level).toBe("ok");
  });
});

describe("budget", () => {
  it("GEPRC 136K / 104K / 17K → 76% used, 15K left, not hot", () => {
    const s = budgetSummary({ budget: 136_000, purchased: 104_000, committed: 17_000 });
    expect(s.available).toBe(15_000);
    expect(Math.round(s.utilization * 100)).toBe(76);
    expect(s.hot).toBe(false);
  });
  it("DJI 109K / 85K / 19K → over 95% committed → hot", () => {
    expect(budgetSummary({ budget: 109_000, purchased: 85_000, committed: 19_000 }).hot).toBe(true);
  });
  it("zero budget with spend is hot", () => {
    expect(budgetSummary({ budget: 0, purchased: 10, committed: 0 }).hot).toBe(true);
  });
  it("buckets", () => {
    expect(budgetBucket({ poStatus: "DRAFT", shipmentStatus: "NOT_SHIPPED" })).toBe("none");
    expect(budgetBucket({ poStatus: "CANCELLED", shipmentStatus: "NOT_SHIPPED" })).toBe("none");
    expect(budgetBucket({ poStatus: "CONFIRMED", shipmentStatus: "NOT_SHIPPED" })).toBe("committed");
    expect(budgetBucket({ poStatus: "SENT", shipmentStatus: "NOT_SHIPPED" })).toBe("committed");
    expect(budgetBucket({ poStatus: "CONFIRMED", shipmentStatus: "IN_TRANSIT" })).toBe("purchased");
    expect(budgetBucket({ poStatus: "CLOSED", shipmentStatus: "DELIVERED" })).toBe("purchased");
  });
  it("create-PO check warns when the PO exceeds available", () => {
    const s = budgetSummary({ budget: 100, purchased: 50, committed: 30 });
    expect(budgetCheck(s, 20)).toEqual({ hasBudget: true, fits: true, availableAfter: 0 });
    expect(budgetCheck(s, 21).fits).toBe(false);
    expect(budgetCheck(null, 1000)).toEqual({ hasBudget: false, fits: true, availableAfter: null });
  });
});

describe("poStage (prototype sample)", () => {
  const base: StatusSet = { poStatus: "CONFIRMED", paymentStatus: "PAID", productionStatus: "NOT_STARTED", shipmentStatus: "NOT_SHIPPED", customsStatus: "NOT_STARTED", inventoryStatus: "NOT_RECEIVED" };
  const st = (o: Partial<StatusSet>, next: string | null = null) => poStage({ ...base, ...o }, next, TODAY);
  it("maps every sample PO to its prototype stage", () => {
    expect(st({ poStatus: "SENT", paymentStatus: "PENDING" })).toBe("PO Sent"); // TM, BF
    expect(st({ productionStatus: "IN_PRODUCTION", paymentStatus: "PARTIALLY_PAID" })).toBe("Production"); // GE
    expect(st({ productionStatus: "DELAYED" })).toBe("Production"); // IF, AX, RC
    expect(st({ productionStatus: "COMPLETED", shipmentStatus: "IN_TRANSIT" })).toBe("In Transit"); // CD, HG
    expect(st({ productionStatus: "COMPLETED", shipmentStatus: "IN_TRANSIT", customsStatus: "DOCUMENTS_REQUIRED" })).toBe("Customs"); // FX
    expect(st({ productionStatus: "COMPLETED", shipmentStatus: "SHIPPED" })).toBe("Shipped"); // DJ
    expect(st({ productionStatus: "READY", shipmentStatus: "READY_TO_SHIP" })).toBe("Ready to Ship"); // TB
  });
  it("early and late stages", () => {
    expect(st({ poStatus: "DRAFT" })).toBe("Draft");
    expect(st({ poStatus: "CLOSED" })).toBe("Closed");
    expect(st({ poStatus: "CANCELLED" })).toBeNull();
    expect(st({ inventoryStatus: "PARTIALLY_RECEIVED" })).toBe("Received");
    expect(st({ paymentStatus: "PAID" })).toBe("Paid");
    expect(st({ paymentStatus: "PENDING" }, "2026-09-28")).toBe("Payment Pending");
    expect(st({ paymentStatus: "OVERDUE" })).toBe("Payment Pending");
    expect(st({ paymentStatus: "PENDING" }, "2026-10-20")).toBe("Confirmed");
  });
});

describe("list order + filters", () => {
  it("sorts Delayed, Needs Attention, On Track, then ETA with none last", () => {
    const rows = [
      { id: "a", health: "ON_TRACK" as const, eta: "2026-10-02" },
      { id: "b", health: "NEEDS_ATTENTION" as const, eta: null },
      { id: "c", health: "DELAYED" as const, eta: "2026-10-15" },
      { id: "d", health: "NEEDS_ATTENTION" as const, eta: "2026-09-29" },
      { id: "e", health: "DELAYED" as const, eta: "2026-10-08" },
    ];
    expect(rows.sort(compareByHealth).map((r) => r.id)).toEqual(["e", "c", "d", "b", "a"]);
  });
  const po = (o: Partial<StatusSet & { health: "ON_TRACK" | "NEEDS_ATTENTION" | "DELAYED" }>) => ({
    poStatus: "CONFIRMED" as const, paymentStatus: "PAID" as const, productionStatus: "IN_PRODUCTION" as const, shipmentStatus: "NOT_SHIPPED" as const,
    customsStatus: "NOT_STARTED" as const, inventoryStatus: "NOT_RECEIVED" as const, health: "ON_TRACK" as const, ...o,
  });
  it("quick filters", () => {
    expect(matchesFilter(po({ health: "DELAYED" }), "attention")).toBe(true);
    expect(matchesFilter(po({}), "attention")).toBe(false);
    expect(matchesFilter(po({ paymentStatus: "PARTIALLY_PAID" }), "payment")).toBe(true);
    expect(matchesFilter(po({ poStatus: "DRAFT", paymentStatus: "PENDING" }), "payment")).toBe(false);
    expect(matchesFilter(po({ poStatus: "SENT" }), "unconfirmed")).toBe(true);
    expect(matchesFilter(po({ shipmentStatus: "SHIPPED" }), "transit")).toBe(true);
    expect(matchesFilter(po({ productionStatus: "DELAYED" }), "production")).toBe(true);
    expect(matchesFilter(po({ customsStatus: "DOCUMENTS_REQUIRED" }), "customs")).toBe(true);
    expect(matchesFilter(po({ poStatus: "CLOSED" }), "open")).toBe(false);
    expect(matchesFilter(po({ poStatus: "CLOSED" }), "closed")).toBe(true);
    expect(matchesFilter(po({ poStatus: "CLOSED" }), "all")).toBe(true);
  });
});

describe("supplierPerformance", () => {
  it("averages lead time and counts on-time arrivals", () => {
    const p = supplierPerformance([
      { orderDate: "2026-01-01", eta: "2026-01-15", arrivedAt: "2026-01-15" },
      { orderDate: "2026-02-01", eta: "2026-02-15", arrivedAt: "2026-02-19" },
      { orderDate: "2026-03-01", eta: null, arrivedAt: "2026-03-13" },
    ]);
    expect(p).toEqual({ leadTimeDays: 15, onTimeRate: 50, completed: 3 });
  });
  it("no history", () => {
    expect(supplierPerformance([])).toEqual({ leadTimeDays: null, onTimeRate: null, completed: 0 });
  });
});

describe("notifications engine", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const base: NotificationPoInput = {
    number: "X-1", supplier: "S", poStatus: "CONFIRMED", paymentStatus: "PAID", productionStatus: "IN_PRODUCTION", shipmentStatus: "NOT_SHIPPED",
    customsStatus: "NOT_STARTED", health: "ON_TRACK", healthReason: "ETA Oct 9", productionNote: null, sentAt: new Date("2026-09-15T00:00:00Z"),
    eta: "2026-10-09", carrier: null, trackingNumber: null, missingCustomsDoc: null, unpaidPayments: [],
  };
  const run = (o: Partial<NotificationPoInput>) => notificationsFor({ ...base, ...o }, TODAY, now);

  it("on-track PO produces nothing", () => {
    expect(run({})).toEqual([]);
  });
  it("IF-26094 delayed → red Delay with production note", () => {
    const [n] = run({ number: "IF-26094", health: "DELAYED", healthReason: "Production past expected date", productionStatus: "DELAYED", productionNote: "ESC board shortage." });
    expect(n).toMatchObject({ tone: "RED", kind: "Delay", title: "PO #IF-26094 is delayed", detail: "Production past expected date. ESC board shortage." });
  });
  it("RC-26096 overdue → only the payment notification, not a second delay one", () => {
    const ns = run({ number: "RC-26096", health: "DELAYED", paymentStatus: "OVERDUE", productionStatus: "DELAYED", unpaidPayments: [{ id: "p2", type: "BALANCE", amount: 4820, dueDate: "2026-09-20" }] });
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ tone: "RED", title: "Payment for PO #RC-26096 is overdue", detail: "Balance of $4,820 was due Sep 20." });
  });
  it("TM-26092 deposit due tomorrow → orange; confirmation pending > 48h → orange", () => {
    const ns = run({ number: "TM-26092", poStatus: "SENT", sentAt: new Date("2026-09-22T00:00:00Z"), unpaidPayments: [{ id: "p1", type: "DEPOSIT", amount: 2100, dueDate: "2026-09-27" }] });
    expect(ns.map((n) => n.title)).toEqual(["Payment for PO #TM-26092 is due tomorrow", "Supplier confirmation pending for PO #TM-26092"]);
    expect(ns[0].detail).toBe("Deposit of $2,100 due Sep 27.");
  });
  it("confirmation within 48h → nothing", () => {
    expect(run({ poStatus: "SENT", sentAt: new Date("2026-09-25T00:00:00Z") })).toEqual([]);
  });
  it("payment due in 2 days → nothing (rule is within 1 day)", () => {
    expect(run({ unpaidPayments: [{ id: "p", type: "BALANCE", amount: 1, dueDate: "2026-09-28" }] })).toEqual([]);
  });
  it("FX-26095 customs docs missing", () => {
    const [n] = run({ number: "FX-26095", customsStatus: "DOCUMENTS_REQUIRED", missingCustomsDoc: "Certificate of origin", eta: "2026-09-29", shipmentStatus: "IN_TRANSIT" });
    expect(n).toMatchObject({ tone: "ORANGE", detail: "Certificate of origin missing. Shipment lands Sep 29." });
  });
  it("CD-26093 arriving in 2 days → blue", () => {
    const [n] = run({ number: "CD-26093", shipmentStatus: "IN_TRANSIT", eta: "2026-09-28", carrier: "DHL Express", trackingNumber: "4829 1057 36" });
    expect(n).toMatchObject({ tone: "BLUE", title: "Shipment #CD-26093 is arriving in 2 days", detail: "DHL Express · 4829 1057 36" });
  });
  it("dedupe keys are stable and prefixed", () => {
    const a = run({ health: "DELAYED", healthReason: "Held at customs" });
    const b = run({ health: "DELAYED", healthReason: "Held at customs" });
    expect(a[0].dedupeKey).toBe(b[0].dedupeKey);
    expect(a[0].dedupeKey.startsWith("rule:")).toBe(true);
  });
});

describe("calendar events", () => {
  it("derives payments, production, shipment, arrival and customs events", () => {
    const ev = calendarEvents({
      number: "FX-26095", supplier: "Foxeer", expectedProductionDate: "2026-09-12", productionDone: true, eta: "2026-09-29",
      customsStatus: "DOCUMENTS_REQUIRED", missingCustomsDoc: "Certificate of origin",
      payments: [{ type: "BALANCE", dueDate: "2026-09-09", paidDate: "2026-09-09" }],
      shipments: [{ shipDate: "2026-09-14", eta: "2026-09-29", actualArrival: null }],
    }).sort(compareEvents);
    expect(ev.map((e) => [e.date, e.type, e.title])).toEqual([
      ["2026-09-09", "Payment", "Foxeer balance paid"],
      ["2026-09-14", "Shipment", "Foxeer shipment dispatched"],
      ["2026-09-29", "Customs", "Foxeer certificate of origin due"],
      ["2026-09-29", "Arrival", "Foxeer shipment ETA"],
    ]);
  });
  it("unpaid payment and pending production show as due", () => {
    const ev = calendarEvents({
      number: "GE-26091", supplier: "GEPRC", expectedProductionDate: "2026-10-01", productionDone: false, eta: "2026-10-04", customsStatus: "NOT_STARTED",
      missingCustomsDoc: null, payments: [{ type: "BALANCE", dueDate: "2026-09-28", paidDate: null }], shipments: [],
    });
    expect(ev.map((e) => e.title)).toEqual(["GEPRC balance due", "GEPRC production complete", "GEPRC shipment ETA"]);
  });
  it("arrived shipment replaces the ETA", () => {
    const ev = calendarEvents({
      number: "A", supplier: "S", expectedProductionDate: null, productionDone: true, eta: "2026-09-10", customsStatus: "CLEARED", missingCustomsDoc: null,
      payments: [], shipments: [{ shipDate: null, eta: "2026-09-10", actualArrival: "2026-09-12" }],
    });
    expect(ev).toEqual([{ date: "2026-09-12", title: "S shipment arrived", type: "Arrival", poNumber: "A", done: true }]);
  });
});
