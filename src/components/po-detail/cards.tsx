import {
  CustomsCostDialog,
  CustomsDocUpload,
  MilestoneDialog,
  ReceiveDialog,
  RecordPaymentDialog,
  SchedulePaymentDialog,
  ShipmentDialog,
  ProductionDialog,
} from "@/components/po-detail/dialogs";
import { CustomsStatusSelect } from "@/components/po-detail/CustomsStatusSelect";
import { ActionButton } from "@/components/ui/ActionButton";
import { Progress } from "@/components/ui/Bars";
import { Card, Empty } from "@/components/ui/Card";
import { FileChip } from "@/components/ui/FileChip";
import { Pill } from "@/components/ui/Pill";
import type { IsoDate } from "@/lib/dates";
import { CUSTOMS_DOC_LABEL } from "@/lib/domain/customs";
import { fmtDate, usd, usdR } from "@/lib/format";
import { MILESTONE_LABEL, PAYMENT_TYPE_LABEL, poLabels } from "@/lib/status";
import { trackingLink } from "@/lib/tracking";
import { MILESTONES } from "@/lib/validation/po";
import type { PoDetail } from "@/server/queries/po-detail";
import { deleteScheduledPayment, markCustomsDocument } from "@/server/services/po";

// ─── Timeline ────────────────────────────────────────────────────────────────

export function Timeline({ po }: { po: PoDetail }) {
  const firstPaid = po.payments.filter((p) => p.paidDate).map((p) => p.paidDate!).sort()[0] ?? null;
  const ev = po.shipment?.events ?? {};
  const steps: { label: string; date: IsoDate | null; done: boolean; started: boolean }[] = [
    { label: "Created", date: po.orderDate, done: true, started: true },
    { label: "Confirmed", date: po.confirmedAt, done: !!po.confirmedAt || po.poStatus === "CONFIRMED" || po.poStatus === "CLOSED", started: po.poStatus === "SENT" },
    { label: "Paid", date: firstPaid, done: !!firstPaid, started: false },
    { label: "Production", date: po.productionCompletedAt ?? po.productionStartedAt, done: po.productionStatus === "COMPLETED" || po.productionStatus === "READY", started: !!po.productionStartedAt },
    { label: "Shipped", date: po.shipment?.shipDate ?? ev.PICKED_UP ?? null, done: !!(po.shipment?.shipDate || ev.PICKED_UP), started: po.shipmentStatus === "READY_TO_SHIP" },
    { label: "In Transit", date: ev.IN_TRANSIT ?? null, done: !!ev.IN_TRANSIT, started: false },
    { label: "Received", date: po.received ? (po.shipment?.actualArrival ?? null) : null, done: po.inventoryStatus === "RECEIVED" || po.inventoryStatus === "STOCKED", started: po.inventoryStatus === "PARTIALLY_RECEIVED" },
  ];
  const current = steps.findIndex((s) => !s.done);
  const delayed = po.health === "DELAYED";
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 pt-2">
        {steps.map((s, i) => {
          const cur = i === current;
          const dot = s.done ? "bg-ink border-ink" : cur ? (delayed ? "bg-red-dot border-red-dot" : "bg-blue-dot border-blue-dot") : "bg-page border-neutral-400";
          return (
            <div key={s.label} className="relative flex flex-col gap-1 pr-2">
              <div className="relative flex h-4 items-center">
                <span className={`z-10 size-3.5 rounded-full border-2 ${dot}`} />
                {i < 6 && <span className={`absolute top-1/2 left-3.5 h-0.5 w-full -translate-y-1/2 ${steps[i + 1].done || i + 1 === current ? "bg-ink" : "bg-neutral-300"}`} />}
              </div>
              <span className={`mt-2 text-sm ${cur ? `font-semibold ${delayed ? "text-red-fg" : "text-blue-fg"}` : s.done ? "" : "text-neutral-600"}`}>{s.label}</span>
              <span className="text-xs text-secondary">{(s.done || (cur && s.started)) && s.date ? fmtDate(s.date) : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export function ProductsCard({ po, today, canReceive }: { po: PoDetail; today: string; canReceive: boolean }) {
  return (
    <Card title="Products" aside={canReceive ? <ReceiveDialog po={po} today={today} button={{ label: "Receive goods", className: "btn btn-ghost" }} /> : `${po.items.length} line ${po.items.length === 1 ? "item" : "items"}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-secondary">
              <th className="py-2.5 font-normal">SKU</th>
              <th className="font-normal">Product</th>
              <th className="text-right font-normal">Ordered</th>
              <th className="text-right font-normal">Received</th>
              <th className="text-right font-normal">Unit Price</th>
              <th className="text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((i) => (
              <tr key={i.id} className="border-b border-neutral-200">
                <td className="py-3 text-[13px] text-secondary">{i.sku}</td>
                <td className="font-semibold">{i.name}</td>
                <td className="text-right">{i.qty.toLocaleString()}</td>
                <td className={`text-right ${i.received && i.received < i.qty ? "text-blue-fg" : ""}`}>{i.received.toLocaleString()}</td>
                <td className="text-right">
                  {usd(i.unitPrice)}
                  {i.discountPct ? <span className="block text-xs text-secondary">−{i.discountPct}%</span> : null}
                  {i.taxPct ? <span className="block text-xs text-secondary">+{i.taxPct}% tax</span> : null}
                </td>
                <td className="text-right">{usd(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line py-3 text-sm">
        <span>
          <span className="text-secondary">Total Units:</span> <b>{po.units.toLocaleString()}</b>
        </span>
        <span>
          <span className="text-secondary">Received:</span> <b>{po.received.toLocaleString()}</b>
        </span>
        <span>
          <span className="text-secondary">Remaining:</span> <b>{(po.units - po.received).toLocaleString()}</b>
        </span>
        <span className="flex-1" />
        <span>
          <span className="text-secondary">Order total</span> <b>{usd(po.total)}</b>
        </span>
      </div>
    </Card>
  );
}

export function PaymentCard({ po, today, canPay }: { po: PoDetail; today: string; canPay: boolean }) {
  const pct = po.total ? po.pay.paid / po.total : 0;
  const receipts = po.payments.filter((p) => p.receipt);
  const next = po.payments.find((p) => !p.paidDate);
  const note =
    po.paymentStatus === "OVERDUE" && po.pay.overdueSince
      ? `Payment overdue since ${fmtDate(po.pay.overdueSince)}.`
      : po.paymentStatus === "PAID"
        ? "Fully paid."
        : next
          ? `${PAYMENT_TYPE_LABEL[next.type]} of ${usd(next.amount)} due ${fmtDate(next.dueDate)}.`
          : "Nothing scheduled.";
  return (
    <Card title="Payment" aside={<Pill label={poLabels(po).pay} />}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[26px] font-semibold tracking-[-0.02em]">
          {usd(po.pay.paid)} / {usd(po.total)} paid
        </span>
        <span className="text-[15px] font-semibold">{Math.round(pct * 100)}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-secondary">
              <th className="py-2.5 font-normal">Payment</th>
              <th className="text-right font-normal">Amount</th>
              <th className="pl-4 font-normal">Due Date</th>
              <th className="font-normal">Status</th>
              <th className="font-normal">Method · Reference</th>
              {canPay && <th />}
            </tr>
          </thead>
          <tbody>
            {po.payments.map((p) => (
              <tr key={p.id} className="border-b border-neutral-200">
                <td className="py-2.5 font-semibold">{PAYMENT_TYPE_LABEL[p.type]}</td>
                <td className="text-right">{usd(p.amount)}</td>
                <td className="pl-4">{fmtDate(p.dueDate)}</td>
                <td>
                  <Pill label={p.status} />
                </td>
                <td className="text-[13px] leading-tight">
                  {p.paidDate ? `${p.method ?? "—"} · ${fmtDate(p.paidDate)}` : `${p.method ?? "Bank transfer (TT)"}, scheduled`}
                  <span className="block text-xs text-secondary">{p.bankReference ?? "—"}</span>
                </td>
                {canPay && (
                  <td className="text-right">
                    {!p.paidDate && (
                      <ActionButton action={deleteScheduledPayment.bind(null, p.id)} confirm="Remove this scheduled payment?" className="btn btn-ghost px-1.5! py-0.5! text-xs">
                        Remove
                      </ActionButton>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {po.payments.length === 0 && <Empty>No payments scheduled.</Empty>}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-3 text-sm">
        {receipts.map((p) => (
          <a key={p.id} href={`/api/documents/${p.receipt!.id}`} target="_blank" className="inline-flex items-center gap-2 border border-line px-2.5 py-1.5 hover:bg-surface">
            <FileChip fileName={p.receipt!.fileName} />
            {p.receipt!.fileName}
          </a>
        ))}
        <span className={po.paymentStatus === "OVERDUE" ? "font-semibold text-red-fg" : "text-secondary"}>{note}</span>
        {canPay && (
          <span className="ml-auto flex gap-2">
            <SchedulePaymentDialog po={po} button={{ label: "Schedule", className: "btn btn-ghost" }} />
            {po.payments.some((p) => !p.paidDate) && <RecordPaymentDialog po={po} today={today} button={{ label: "Record payment" }} />}
          </span>
        )}
      </div>
    </Card>
  );
}

export function ShipmentCard({ po, today, canShip }: { po: PoDetail; today: string; canShip: boolean }) {
  const s = po.shipment;
  const link = trackingLink(s?.carrier ?? po.plannedCarrier, s?.trackingNumber ?? null, s?.trackingUrl);
  const reached = s ? MILESTONES.indexOf(s.milestone) : -1;
  const info: [string, string][] = [
    ["Carrier", s ? s.carrier : `${po.plannedCarrier ?? "—"} (planned)`],
    ["Tracking Number", s?.trackingNumber ?? "Not assigned"],
    ["Origin", s?.origin ?? po.supplier.origin],
    ["Destination", s?.destination ?? "Dubai, UAE"],
    ["Shipment date", fmtDate(s?.shipDate)],
    ["Estimated arrival", fmtDate(s?.eta ?? po.eta)],
    ["Actual arrival", fmtDate(s?.actualArrival)],
    ["Shipping cost", s?.shippingCost != null ? usdR(s.shippingCost) : "Quote pending"],
  ];
  return (
    <Card title="Shipment" aside={<Pill label={poLabels(po).ship} />}>
      <div className="grid gap-6 sm:grid-cols-[1fr_210px]">
        <div>
          {info.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] gap-3 border-b border-neutral-200 py-2 text-sm">
              <span className="text-secondary">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-3">
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost px-1!">
                Open tracking link →
              </a>
            )}
            {canShip && <ShipmentDialog po={po} button={{ label: s ? "Edit shipment" : "Create shipment" }} />}
            {canShip && s && s.milestone !== "DELIVERED" && <MilestoneDialog po={po} today={today} button={{ label: "Update milestone" }} />}
          </div>
        </div>
        <ol className="flex flex-col">
          {MILESTONES.map((m, i) => {
            const done = s && (i < reached || s.milestone === "DELIVERED");
            const cur = s && i === reached && s.milestone !== "DELIVERED";
            const date = s?.events[m];
            return (
              <li key={m} className="grid grid-cols-[16px_1fr_auto] gap-2.5">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 size-3 rounded-full border-2 ${done ? "border-ink bg-ink" : cur ? (po.customsStatus === "DOCUMENTS_REQUIRED" ? "border-orange-dot bg-orange-dot" : "border-blue-dot bg-blue-dot") : "border-neutral-400 bg-page"}`} />
                  {i < 5 && <span className={`w-0.5 flex-1 ${done ? "bg-ink" : "bg-neutral-300"}`} style={{ minHeight: 18 }} />}
                </div>
                <span className={`pb-3 text-sm ${cur ? "font-semibold" : done ? "" : "text-neutral-600"}`}>{MILESTONE_LABEL[m]}</span>
                <span className="text-xs text-secondary">{date && (done || cur) ? fmtDate(date) : ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

export function ProductionCard({ po, canEdit }: { po: PoDetail; canEdit: boolean }) {
  return (
    <Card title="Production" aside={<Pill label={poLabels(po).prod} />}>
      <div className="flex justify-between py-1 text-sm">
        <span className="text-secondary">Supplier-reported progress</span>
        <b>{po.productionProgressPct}%</b>
      </div>
      <Progress value={po.productionProgressPct / 100} className="my-2 h-1.5" color={po.productionStatus === "DELAYED" ? "bg-red-dot" : "bg-blue-dot"} />
      {[
        ["Production started", fmtDate(po.productionStartedAt)],
        ["Expected completion", fmtDate(po.expectedProductionDate)],
        ["Actual completion", fmtDate(po.productionCompletedAt)],
        ["Last supplier update", fmtDate(po.lastSupplierUpdateAt)],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-neutral-200 py-2 text-sm">
          <span className="text-secondary">{k}</span>
          <b>{v}</b>
        </div>
      ))}
      {po.productionNote && (
        <div className="mt-3 rounded-[10px] bg-neutral-100 px-3.5 py-3 text-sm leading-normal">
          <div className="mb-1 text-[12.5px] text-secondary">Supplier production notes</div>
          {po.productionNote}
        </div>
      )}
      {canEdit && (
        <div className="pt-3">
          <ProductionDialog po={po} button={{ label: "Update production" }} />
        </div>
      )}
    </Card>
  );
}

export function CustomsCard({ po, canEdit }: { po: PoDetail; canEdit: boolean }) {
  const s = po.shipment;
  const ICON = { RECEIVED: ["✓", "bg-green-bg text-green-fg"], MISSING: ["✕", "bg-red-bg text-red-fg"], PENDING: ["–", "bg-gray-bg text-gray-fg"] } as const;
  const est = po.costs.estimated ? " (est.)" : "";
  const docsEditable = canEdit && po.customsStatus !== "CLEARED";
  return (
    <Card title="Customs" aside={canEdit ? <CustomsStatusSelect poId={po.id} value={po.customsStatus} /> : <Pill label={poLabels(po).customs} />}>
      {s ? (
        s.customsDocuments.map((d) => (
          <div key={d.id} className="flex items-center gap-2.5 border-b border-neutral-200 py-2 text-sm">
            <span className={`flex size-[18px] flex-none items-center justify-center text-[11px] font-bold ${ICON[d.status][1]}`}>{ICON[d.status][0]}</span>
            <span className="min-w-0 flex-1">
              {d.document ? (
                <a href={`/api/documents/${d.document.id}`} target="_blank" className="underline decoration-neutral-400 underline-offset-2">
                  {CUSTOMS_DOC_LABEL[d.type]}
                </a>
              ) : (
                CUSTOMS_DOC_LABEL[d.type]
              )}
            </span>
            {docsEditable && d.status !== "RECEIVED" && (
              <ActionButton action={markCustomsDocument.bind(null, d.id, "RECEIVED")} className="btn btn-ghost px-1.5! py-0.5! text-xs">
                Mark received
              </ActionButton>
            )}
            {docsEditable && d.status === "PENDING" && (
              <ActionButton action={markCustomsDocument.bind(null, d.id, "MISSING")} className="btn btn-ghost px-1.5! py-0.5! text-xs">
                Missing
              </ActionButton>
            )}
            {docsEditable && !d.document && <CustomsDocUpload id={d.id} label={CUSTOMS_DOC_LABEL[d.type]} />}
            <span className={`text-xs ${d.status === "MISSING" ? "font-semibold text-red-fg" : "text-secondary"}`}>{d.status === "RECEIVED" ? "Received" : d.status === "MISSING" ? "Missing" : "Pending"}</span>
          </div>
        ))
      ) : (
        <Empty>The document checklist starts when a shipment is created.</Empty>
      )}
      <div className="mt-3 flex flex-col text-sm">
        {[
          [`Customs Duty${est}`, usdR(po.costs.duty)],
          [`Import VAT${est}`, usdR(po.costs.importVat)],
          [`Clearance Charges${est}`, usdR(po.costs.clearanceCharges)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-1">
            <span className="text-secondary">{k}</span>
            <span>{v}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
          <span>Total Import Cost</span>
          <span>{usdR(po.costs.total)}</span>
        </div>
        {canEdit && s && (
          <div className="pt-3">
            <CustomsCostDialog po={po} button={{ label: po.costs.estimated ? "Enter actual costs" : "Edit costs" }} />
          </div>
        )}
      </div>
    </Card>
  );
}
