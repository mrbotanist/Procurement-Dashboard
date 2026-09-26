import { describe, expect, it } from "vitest";
import { computeHealth, type HealthInput } from "../health";

const TODAY = "2026-09-26";
const base: HealthInput = {
  poStatus: "CONFIRMED",
  paymentStatus: "PAID",
  productionStatus: "IN_PRODUCTION",
  customsStatus: "NOT_STARTED",
  eta: "2026-10-09",
  overdueSince: null,
  nextDueDate: null,
  missingCustomsDoc: null,
};
const h = (o: Partial<HealthInput>) => computeHealth({ ...base, ...o }, TODAY);

describe("computeHealth", () => {
  it("1. overdue payment → Delayed (RC-26096)", () => {
    expect(h({ paymentStatus: "OVERDUE", overdueSince: "2026-09-20", productionStatus: "DELAYED" })).toEqual({
      health: "DELAYED",
      reason: "Balance overdue since Sep 20",
    });
  });
  it("2. production delayed → Delayed", () => {
    expect(h({ productionStatus: "DELAYED" })).toEqual({ health: "DELAYED", reason: "Production past expected date" });
  });
  it("3. customs on hold → Delayed", () => {
    expect(h({ customsStatus: "ON_HOLD" })).toEqual({ health: "DELAYED", reason: "Held at customs" });
  });
  it("4. draft → Needs Attention", () => {
    expect(h({ poStatus: "DRAFT" })).toEqual({ health: "NEEDS_ATTENTION", reason: "Draft not sent to supplier" });
  });
  it("5. sent → Needs Attention", () => {
    expect(h({ poStatus: "SENT", paymentStatus: "PENDING" })).toEqual({ health: "NEEDS_ATTENTION", reason: "Awaiting supplier confirmation" });
  });
  it("6. documents required → names the missing document (FX-26095)", () => {
    expect(h({ customsStatus: "DOCUMENTS_REQUIRED", missingCustomsDoc: "Certificate of origin" })).toEqual({
      health: "NEEDS_ATTENTION",
      reason: "Certificate of origin missing",
    });
  });
  it("7. partially paid, balance due within 3 days (GE-26091)", () => {
    expect(h({ paymentStatus: "PARTIALLY_PAID", nextDueDate: "2026-09-28" })).toEqual({ health: "NEEDS_ATTENTION", reason: "Balance due in 2 days" });
    expect(h({ paymentStatus: "PARTIALLY_PAID", nextDueDate: "2026-09-27" }).reason).toBe("Balance due in 1 day");
    expect(h({ paymentStatus: "PARTIALLY_PAID", nextDueDate: "2026-09-26" }).reason).toBe("Balance due today");
  });
  it("7. partially paid, balance due later → On Track (TB-26101)", () => {
    expect(h({ paymentStatus: "PARTIALLY_PAID", nextDueDate: "2026-10-03", eta: "2026-10-06" })).toEqual({ health: "ON_TRACK", reason: "ETA Oct 6" });
  });
  it("8. otherwise On Track, with or without ETA", () => {
    expect(h({})).toEqual({ health: "ON_TRACK", reason: "ETA Oct 9" });
    expect(h({ eta: null }).reason).toBe("Progressing to plan");
  });
  it("received goods → On Track, all goods received", () => {
    expect(h({ received: true })).toEqual({ health: "ON_TRACK", reason: "All goods received" });
    expect(h({ received: true, paymentStatus: "OVERDUE", overdueSince: "2026-09-20" }).health).toBe("DELAYED");
  });
  it("rules are evaluated in order: overdue beats draft", () => {
    expect(h({ poStatus: "DRAFT", paymentStatus: "OVERDUE", overdueSince: "2026-09-20" }).health).toBe("DELAYED");
  });
});
