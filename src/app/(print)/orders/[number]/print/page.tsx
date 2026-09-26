import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "./PrintButton";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import { fmtDateLong, usd } from "@/lib/format";
import { getPoDetail } from "@/server/queries/po-detail";

export async function generateMetadata({ params }: PageProps<"/orders/[number]/print">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Purchase Order ${decodeURIComponent(number)}` };
}

/** Printable purchase order (browser "Save as PDF"). */
export default async function PrintPo({ params }: PageProps<"/orders/[number]/print">) {
  await requirePermission("view:orders");
  const { number } = await params;
  const po = await getPoDetail(decodeURIComponent(number), todayIso());
  if (!po) notFound();
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: po.supplier.id } });

  return (
    <div className="mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-relaxed text-ink print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <header className="flex items-start justify-between border-b-2 border-ink pb-4">
        <div>
          <div className="text-lg font-semibold">FPV Store</div>
          <div className="text-secondary">Dubai, United Arab Emirates</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tracking-tight">PURCHASE ORDER</div>
          <div className="text-base font-semibold">{po.number}</div>
          <div className="text-secondary">{fmtDateLong(po.orderDate)}</div>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-8 py-5">
        <div>
          <div className="mb-1 text-xs tracking-wide text-secondary uppercase">Supplier</div>
          <div className="font-semibold">{supplier.name}</div>
          {supplier.contactName && <div>Attn: {supplier.contactName}</div>}
          <div>{po.supplier.origin}</div>
          {supplier.email && <div>{supplier.email}</div>}
          {supplier.phone && <div>{supplier.phone}</div>}
        </div>
        <div>
          <div className="mb-1 text-xs tracking-wide text-secondary uppercase">Terms</div>
          <div>Currency: {po.currency}</div>
          <div>Payment: {po.paymentTerms ?? "—"}</div>
          <div>Incoterms: {[po.incoterm, supplier.incotermPlace].filter(Boolean).join(" ") || "—"}</div>
          <div>Carrier: {po.plannedCarrier ?? "—"}</div>
          {po.expectedShipDate && <div>Ship by: {fmtDateLong(po.expectedShipDate)}</div>}
          <div>Deliver to: Dubai, UAE</div>
        </div>
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-ink text-left">
            <th className="py-2">SKU</th>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit price</th>
            <th className="text-right">Disc.</th>
            <th className="text-right">Tax</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-2">{i.sku}</td>
              <td>{i.name}</td>
              <td className="text-right">{i.qty.toLocaleString()}</td>
              <td className="text-right">{usd(i.unitPrice)}</td>
              <td className="text-right">{i.discountPct ? `${i.discountPct}%` : "—"}</td>
              <td className="text-right">{i.taxPct ? `${i.taxPct}%` : "—"}</td>
              <td className="text-right">{usd(i.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="pt-3 text-right font-semibold">
              Total ({po.currency})
            </td>
            <td className="pt-3 text-right text-base font-semibold">{usd(po.total)}</td>
          </tr>
        </tfoot>
      </table>
      {po.notes && (
        <section className="mt-6">
          <div className="mb-1 text-xs tracking-wide text-secondary uppercase">Notes</div>
          <p className="whitespace-pre-wrap">{po.notes}</p>
        </section>
      )}
      <section className="mt-6">
        <div className="mb-1 text-xs tracking-wide text-secondary uppercase">Payment schedule</div>
        {po.payments.map((p) => (
          <div key={p.id}>
            {p.type === "DEPOSIT" ? "Deposit" : p.type === "BALANCE" ? "Balance" : "Payment"} {usd(p.amount)} — due {fmtDateLong(p.dueDate)}
          </div>
        ))}
      </section>
      <footer className="mt-16 grid grid-cols-2 gap-8 text-secondary">
        <div className="border-t border-ink pt-2">Authorised by FPV Store</div>
        <div className="border-t border-ink pt-2">Accepted by {supplier.name}</div>
      </footer>
    </div>
  );
}
