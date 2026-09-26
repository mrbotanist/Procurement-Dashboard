"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectField, ServiceForm, TextArea } from "@/components/ui/Form";
import { usd } from "@/lib/format";
import { MILESTONE_LABEL, PAYMENT_TYPE_LABEL } from "@/lib/status";
import { CARRIERS, DOCUMENT_TYPES, INCOTERMS, MILESTONES, PAYMENT_METHODS } from "@/lib/validation/po";
import { DOCUMENT_TYPE_LABEL } from "@/lib/status";
import {
  addNote,
  editPo,
  receiveGoods,
  recordPayment,
  saveCustomsCosts,
  saveShipment,
  schedulePayment,
  setCustomsDocument,
  setMilestone,
  updateProduction,
  uploadDocument,
} from "@/server/services/po";
import type { PoDetail } from "@/server/queries/po-detail";

type Btn = { label: string; className?: string };
const trig = ({ label, className = "btn btn-secondary" }: Btn) =>
  function Trigger(open: () => void) {
    return (
      <button type="button" onClick={open} className={className}>
        {label}
      </button>
    );
  };

export function RecordPaymentDialog({ po, today, button }: { po: PoDetail; today: string; button: Btn }) {
  const unpaid = po.payments.filter((p) => !p.paidDate);
  const first = unpaid[0];
  return (
    <Dialog title={`Record payment · ${po.number}`} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={recordPayment} onDone={close} submitLabel="Confirm payment">
          <input type="hidden" name="poId" value={po.id} />
          <div className="flex justify-between rounded-[10px] bg-subtle-2 px-3 py-2.5 text-sm">
            <span>Outstanding to {po.supplier.name}</span>
            <b>{usd(po.pay.outstanding)}</b>
          </div>
          <PaymentFields unpaid={unpaid} first={first} outstanding={po.pay.outstanding} today={today} />
          <div className="field">
            <label htmlFor="receipt">Payment receipt (optional)</label>
            <input id="receipt" name="receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="input py-1.5!" />
          </div>
        </ServiceForm>
      )}
    </Dialog>
  );
}

function PaymentFields({ unpaid, first, outstanding, today }: { unpaid: PoDetail["payments"]; first?: PoDetail["payments"][number]; outstanding: number; today: string }) {
  return (
    <>
      <SelectField
        label="Against"
        name="paymentId"
        defaultValue={first?.id ?? "new"}
        options={[
          ...unpaid.map((p) => ({ value: p.id, label: `${PAYMENT_TYPE_LABEL[p.type]} · ${usd(p.amount)} due ${p.dueDate}` })),
          { value: "new", label: "Other / unscheduled payment" },
        ]}
      />
      <Field label="Amount (USD)" name="amount" type="number" step="0.01" min="0.01" defaultValue={first?.amount ?? outstanding} required hint="Paying less than the scheduled amount keeps the rest open" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payment date" name="paidDate" type="date" defaultValue={today} max={today} required />
        <SelectField label="Method" name="method" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
      </div>
      <Field label="Bank reference" name="bankReference" placeholder="e.g. ENBD-260926-0418" />
      <Field label="Note" name="notes" />
    </>
  );
}

export function SchedulePaymentDialog({ po, button }: { po: PoDetail; button: Btn }) {
  return (
    <Dialog title="Schedule a payment" width={420} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={schedulePayment} onDone={close} submitLabel="Add to schedule">
          <input type="hidden" name="poId" value={po.id} />
          <SelectField label="Type" name="type" options={["DEPOSIT", "BALANCE", "OTHER"].map((t) => ({ value: t, label: PAYMENT_TYPE_LABEL[t as "DEPOSIT"] }))} />
          <Field label="Amount (USD)" name="amount" type="number" step="0.01" min="0.01" required />
          <Field label="Due date" name="dueDate" type="date" required />
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function ProductionDialog({ po, button }: { po: PoDetail; button: Btn }) {
  return (
    <Dialog title={`Production · ${po.number}`} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={updateProduction} onDone={close} submitLabel="Save update">
          <input type="hidden" name="poId" value={po.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Status"
              name="productionStatus"
              defaultValue={po.productionStatus}
              options={[
                { value: "NOT_STARTED", label: "Not started" },
                { value: "IN_PRODUCTION", label: "In production" },
                { value: "DELAYED", label: "Delayed" },
                { value: "READY", label: "Ready (goods done)" },
                { value: "COMPLETED", label: "Completed" },
              ]}
            />
            <Field label="Progress %" name="productionProgressPct" type="number" min={0} max={100} defaultValue={po.productionProgressPct} />
          </div>
          <Field label="Expected completion" name="expectedProductionDate" type="date" defaultValue={po.expectedProductionDate ?? ""} />
          <TextArea label="Note" name="note" placeholder="What the supplier reported" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fromSupplier" /> This update came from the supplier (notifies the team)
          </label>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function ShipmentDialog({ po, button }: { po: PoDetail; button: Btn }) {
  const s = po.shipment;
  return (
    <Dialog title={s ? "Update shipment" : "Create shipment"} width={600} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={saveShipment} onDone={close} submitLabel={s ? "Save shipment" : "Create shipment"}>
          <input type="hidden" name="poId" value={po.id} />
          <input type="hidden" name="shipmentId" value={s?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Carrier" name="carrier" list="carriers" defaultValue={s?.carrier ?? po.plannedCarrier ?? ""} required />
            <Field label="Tracking number" name="trackingNumber" defaultValue={s?.trackingNumber ?? ""} />
            <Field label="Origin" name="origin" defaultValue={s?.origin ?? po.supplier.origin} />
            <Field label="Destination" name="destination" defaultValue={s?.destination ?? "Dubai, UAE"} />
            <Field label="Ship date" name="shipDate" type="date" defaultValue={s?.shipDate ?? ""} />
            <Field label="Estimated arrival" name="eta" type="date" defaultValue={s?.eta ?? po.eta ?? ""} />
            <Field label="Shipping cost (USD)" name="shippingCost" type="number" step="0.01" min={0} defaultValue={s?.shippingCost ?? ""} />
            <Field label="Tracking link" name="trackingUrl" type="url" defaultValue={s?.trackingUrl ?? ""} placeholder="https://" />
          </div>
          <datalist id="carriers">{CARRIERS.map((c) => <option key={c} value={c} />)}</datalist>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function MilestoneDialog({ po, today, button }: { po: PoDetail; today: string; button: Btn }) {
  const s = po.shipment!;
  const next = MILESTONES[Math.min(MILESTONES.indexOf(s.milestone) + 1, MILESTONES.length - 1)];
  return (
    <Dialog title="Shipment milestone" width={420} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={setMilestone} onDone={close} submitLabel="Save milestone">
          <input type="hidden" name="shipmentId" value={s.id} />
          <SelectField label="Reached" name="milestone" defaultValue={next} options={MILESTONES.map((m) => ({ value: m, label: MILESTONE_LABEL[m] }))} />
          <Field label="Date" name="date" type="date" defaultValue={today} max={today} required />
          <p className="text-xs text-secondary">Delivered marks the shipment as arrived. Receive goods separately to update stock.</p>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function CustomsDocUpload({ id, label }: { id: string; label: string }) {
  return (
    <Dialog title={`Upload ${label}`} width={420} trigger={trig({ label: "Upload", className: "btn btn-ghost px-1.5! py-0.5! text-xs" })}>
      {(close) => (
        <ServiceForm action={setCustomsDocument} onDone={close} submitLabel="Upload & mark received">
          <input type="hidden" name="customsDocumentId" value={id} />
          <input type="hidden" name="status" value="RECEIVED" />
          <div className="field">
            <label htmlFor={`cd-${id}`}>File</label>
            <input id={`cd-${id}`} name="file" type="file" required className="input py-1.5!" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" />
          </div>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function CustomsCostDialog({ po, button }: { po: PoDetail; button: Btn }) {
  const c = po.costs;
  return (
    <Dialog title="Actual import costs" width={420} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={saveCustomsCosts} onDone={close} submitLabel="Save costs">
          <input type="hidden" name="shipmentId" value={po.shipment!.id} />
          <Field label="Customs duty (USD)" name="duty" type="number" step="0.01" min={0} defaultValue={Math.round(c.duty)} required />
          <Field label="Import VAT (USD)" name="importVat" type="number" step="0.01" min={0} defaultValue={Math.round(c.importVat)} required />
          <Field label="Clearance charges (USD)" name="clearanceCharges" type="number" step="0.01" min={0} defaultValue={c.clearanceCharges} required />
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function ReceiveDialog({ po, today, button }: { po: PoDetail; today: string; button: Btn }) {
  const open = po.items.filter((i) => i.received < i.qty);
  return (
    <Dialog title={`Receive goods · ${po.number}`} width={620} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={receiveGoods} onDone={close} submitLabel="Receive & update stock">
          <input type="hidden" name="poId" value={po.id} />
          <Field label="Received on" name="date" type="date" defaultValue={today} max={today} required />
          <div className="flex flex-col">
            <div className="grid grid-cols-[1fr_90px_110px] gap-3 border-b border-line py-2 text-[12.5px] text-secondary">
              <span>Product</span>
              <span className="text-right">Remaining</span>
              <span>Receive now</span>
            </div>
            {open.map((i) => (
              <div key={i.id} className="grid grid-cols-[1fr_90px_110px] items-center gap-3 border-b border-neutral-200 py-2 text-sm">
                <span className="min-w-0">
                  <b className="block truncate">{i.name}</b>
                  <span className="text-xs text-secondary">{i.sku}</span>
                </span>
                <span className="text-right">{(i.qty - i.received).toLocaleString()}</span>
                <input type="hidden" name="itemId" value={i.id} />
                <input name="qty" type="number" min={0} max={i.qty - i.received} defaultValue={i.qty - i.received} className="input" aria-label={`Receive ${i.sku}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary">Enter less than the remaining quantity for a partial delivery.</p>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function EditPoDialog({ po, button }: { po: PoDetail; button: Btn }) {
  return (
    <Dialog title={`Edit ${po.number}`} width={600} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={editPo} onDone={close}>
          <input type="hidden" name="poId" value={po.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment terms" name="paymentTerms" defaultValue={po.paymentTerms ?? ""} />
            <SelectField label="Incoterms" name="incoterm" defaultValue={po.incoterm ?? ""} options={[{ value: "", label: "—" }, ...INCOTERMS.map((i) => ({ value: i, label: i }))]} />
            <Field label="Planned carrier" name="plannedCarrier" list="carriers-edit" defaultValue={po.plannedCarrier ?? ""} />
            <Field label="ETA" name="eta" type="date" defaultValue={po.poEta ?? ""} />
            <Field label="Expected production" name="expectedProductionDate" type="date" defaultValue={po.expectedProductionDate ?? ""} />
            <Field label="Expected shipping" name="expectedShipDate" type="date" defaultValue={po.expectedShipDate ?? ""} />
          </div>
          <TextArea label="Notes to supplier" name="notes" defaultValue={po.notes ?? ""} />
          <datalist id="carriers-edit">{CARRIERS.map((c) => <option key={c} value={c} />)}</datalist>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function UploadDocDialog({ poId, supplierId, button, suppliers, pos }: { poId?: string; supplierId?: string; button: Btn; suppliers?: { id: string; name: string }[]; pos?: { id: string; number: string }[] }) {
  return (
    <Dialog title="Upload document" width={480} trigger={trig(button)}>
      {(close) => (
        <ServiceForm action={uploadDocument} onDone={close} submitLabel="Upload">
          {poId !== undefined ? <input type="hidden" name="poId" value={poId} /> : pos && <SelectField label="Purchase order" name="poId" options={[{ value: "", label: "— none —" }, ...pos.map((p) => ({ value: p.id, label: p.number }))]} />}
          {supplierId !== undefined ? <input type="hidden" name="supplierId" value={supplierId} /> : suppliers && <SelectField label="Supplier" name="supplierId" options={[{ value: "", label: "— from the PO —" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />}
          <SelectField label="Document type" name="type" options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABEL[t] }))} />
          <Field label="Title (optional)" name="title" placeholder="e.g. Price list Q4" />
          <div className="field">
            <label htmlFor="doc-file">File</label>
            <input id="doc-file" name="file" type="file" required className="input py-1.5!" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx,.txt" />
          </div>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function NoteForm({ poId, canLogSupplier }: { poId: string; canLogSupplier: boolean }) {
  return (
    <ServiceForm action={addNote} resetOnSuccess hideSubmit className="gap-2!">
      <input type="hidden" name="poId" value={poId} />
      <div className="flex gap-2">
        <input name="text" className="input" placeholder="Add an internal note" aria-label="Note" maxLength={2000} />
        <button type="submit" className="btn btn-secondary">
          Add
        </button>
      </div>
      {canLogSupplier && (
        <label className="flex items-center gap-2 text-xs text-secondary">
          <input type="checkbox" name="fromSupplier" /> Log as a supplier update (notifies the team)
        </label>
      )}
    </ServiceForm>
  );
}
