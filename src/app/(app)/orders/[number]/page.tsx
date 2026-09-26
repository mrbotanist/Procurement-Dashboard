import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomsCard, PaymentCard, ProductionCard, ProductsCard, ShipmentCard, Timeline } from "@/components/po-detail/cards";
import { EditPoDialog, NoteForm, ReceiveDialog, RecordPaymentDialog, UploadDocDialog } from "@/components/po-detail/dialogs";
import { ActionButton } from "@/components/ui/ActionButton";
import { Card, Empty } from "@/components/ui/Card";
import { FileChip } from "@/components/ui/FileChip";
import { Page } from "@/components/ui/PageHeader";
import { Pill, toneClasses } from "@/components/ui/Pill";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { fmtDate, fmtDateLong, usd } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL, poLabels, toneFor } from "@/lib/status";
import { getPoDetail } from "@/server/queries/po-detail";
import { cancelPo, closePo, confirmPo, markStocked, sendPo } from "@/server/services/po";

export async function generateMetadata({ params }: PageProps<"/orders/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `PO ${decodeURIComponent(number)}` };
}

export default async function PoPage({ params }: PageProps<"/orders/[number]">) {
  const user = await requirePermission("view:orders");
  const { number } = await params;
  const today = todayIso();
  const po = await getPoDetail(decodeURIComponent(number), today);
  if (!po) notFound();

  const perm = {
    po: can(user.role, "po:write"),
    pay: can(user.role, "payment:write"),
    ship: can(user.role, "shipment:write"),
    receive: can(user.role, "receiving:write"),
    note: can(user.role, "note:write"),
    doc: can(user.role, "document:write"),
  };
  const l = poLabels(po);
  const closed = po.poStatus === "CLOSED" || po.poStatus === "CANCELLED";
  const moving = po.shipmentStatus === "SHIPPED" || po.shipmentStatus === "IN_TRANSIT" || po.shipmentStatus === "DELIVERED";
  const receivable = po.poStatus === "CONFIRMED" && po.received < po.units;
  const tone = toneFor(l.health);
  const mail = po.supplier.email
    ? `mailto:${po.supplier.email}?subject=${encodeURIComponent(`PO ${po.number}`)}&body=${encodeURIComponent(`Hello ${po.supplier.contactName ?? po.supplier.name},\n\nRegarding purchase order ${po.number} (${usd(po.total)}):\n\n`)}`
    : null;

  // Context-dependent primary action.
  let primary: React.ReactNode = null;
  if (po.poStatus === "DRAFT" && perm.po) primary = <ActionButton action={sendPo.bind(null, po.id)} className="btn btn-primary">Mark as sent</ActionButton>;
  else if (po.poStatus === "SENT" && perm.po) primary = <ActionButton action={confirmPo.bind(null, po.id)} className="btn btn-primary">Supplier confirmed</ActionButton>;
  else if (!closed && po.paymentStatus !== "PAID" && perm.pay && po.payments.some((p) => !p.paidDate)) primary = <RecordPaymentDialog po={po} today={today} button={{ label: "Record payment", className: "btn btn-primary" }} />;
  else if (receivable && moving && perm.receive) primary = <ReceiveDialog po={po} today={today} button={{ label: "Mark as received", className: "btn btn-primary" }} />;
  else if (po.inventoryStatus === "RECEIVED" && perm.receive) primary = <ActionButton action={markStocked.bind(null, po.id)} className="btn btn-primary">Mark as stocked</ActionButton>;
  else if ((po.inventoryStatus === "RECEIVED" || po.inventoryStatus === "STOCKED") && po.poStatus === "CONFIRMED" && perm.po) primary = <ActionButton action={closePo.bind(null, po.id)} className="btn btn-primary" confirm="Close this PO?">Close PO</ActionButton>;
  else if (!closed && mail) primary = <a href={mail} className="btn btn-primary">Request update</a>;

  return (
    <Page className="pt-4!">
      <Link href="/orders" className="btn btn-ghost -mb-2 self-start px-1!">
        ← All purchase orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="text-[34px]">PO #{po.number}</h1>
            <span className={`inline-flex items-center gap-2 px-2.5 py-1 text-[13px] font-semibold ${toneClasses(tone).bg} ${toneClasses(tone).fg}`}>
              <span className={`size-2 rounded-full ${toneClasses(tone).dot}`} />
              {po.poStatus === "CANCELLED" ? "Cancelled" : po.poStatus === "CLOSED" ? "Closed" : `${l.health} · ${po.healthReason}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-9 gap-y-3">
            {[
              ["Supplier", <Link key="s" href={`/suppliers/${po.supplier.id}`} className="hover:underline">{po.supplier.name}</Link>],
              ["Brand", po.brand.name],
              ["Order Date", fmtDateLong(po.orderDate)],
              ["Total", usd(po.total)],
              ["Currency", po.currency],
            ].map(([k, v]) => (
              <div key={k as string} className="flex flex-col gap-0.5">
                <span className="text-[12.5px] text-secondary">{k}</span>
                <span className="text-base font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {mail && (
            <a href={mail} className="btn btn-secondary">
              Message supplier
            </a>
          )}
          {perm.po && !closed && <EditPoDialog po={po} button={{ label: "Edit" }} />}
          {perm.po && !closed && po.inventoryStatus === "NOT_RECEIVED" && (
            <ActionButton action={cancelPo.bind(null, po.id) as (reason?: string) => ReturnType<typeof cancelPo>} prompt="Why is this PO being cancelled?" className="btn btn-secondary">
              Cancel PO
            </ActionButton>
          )}
          <a href={`/orders/${po.number}/print`} target="_blank" className="btn btn-secondary">
            Print / PDF
          </a>
          {primary}
        </div>
      </div>

      <Card title="Order Timeline">
        <Timeline po={po} />
        <div className="mt-5 grid border border-line" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          {[
            ["PO Status", l.po],
            ["Payment", l.pay],
            ["Production", l.prod],
            ["Shipment", l.ship],
            ["Customs", l.customs],
            ["Inventory", l.inv],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-2 border-r border-line p-3 last:border-r-0">
              <span className="text-[12.5px] text-secondary">{k}</span>
              <span>
                <Pill label={v} />
              </span>
            </div>
          ))}
        </div>
        {po.notes && <p className="mt-3 text-sm text-secondary">Notes to supplier: {po.notes}</p>}
      </Card>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_620px] flex-col gap-8">
          <ProductsCard po={po} today={today} canReceive={perm.receive && receivable} />
          <PaymentCard po={po} today={today} canPay={perm.pay && !closed} />
          <ShipmentCard po={po} today={today} canShip={perm.ship && !closed && po.poStatus === "CONFIRMED"} />
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-8">
          <ProductionCard po={po} canEdit={perm.po && !closed && po.poStatus === "CONFIRMED"} />
          <CustomsCard po={po} canEdit={perm.ship && !closed} />
          <Card title="Activity">
            {perm.note && (
              <div className="mb-2">
                <NoteForm poId={po.id} canLogSupplier={perm.po} />
              </div>
            )}
            <div className="flex flex-col">
              {po.activity.map((a) => (
                <div key={a.id} className={`my-1.5 border-l-4 py-1 pl-3 ${a.who === "Supplier" ? "border-blue-dot" : a.who === "System" ? "border-orange-dot" : "border-neutral-400"}`}>
                  <span className="text-xs text-secondary">
                    <b className="text-ink">{fmtDate(a.date)}</b> — {a.who}
                  </span>
                  <p className="text-sm">{a.text}</p>
                </div>
              ))}
              {po.activity.length === 0 && <Empty>No activity yet.</Empty>}
            </div>
          </Card>
          <Card title="Documents" aside={perm.doc && <UploadDocDialog poId={po.id} supplierId="" button={{ label: "Upload", className: "btn btn-ghost" }} />}>
            {po.documents.map((d) => (
              <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" className="flex items-center gap-2.5 border-b border-neutral-200 py-2 text-sm last:border-b-0 hover:bg-surface">
                <FileChip fileName={d.fileName} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <b>{d.title ?? DOCUMENT_TYPE_LABEL[d.type]}</b>
                  <span className="truncate text-xs text-secondary">{d.fileName}</span>
                </span>
                <span className="text-xs text-secondary">{fmtDate(d.date)}</span>
              </a>
            ))}
            {po.documents.length === 0 && <Empty>No documents yet.</Empty>}
          </Card>
        </div>
      </div>
    </Page>
  );
}

