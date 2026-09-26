import type { Metadata } from "next";
import Link from "next/link";
import { CustomsCard, ShipmentCard } from "@/components/po-detail/cards";
import { Card, Empty } from "@/components/ui/Card";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Segment } from "@/components/ui/Segment";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toIsoDate, todayIso } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { CUSTOMS_STATUS_LABEL, SHIPMENT_STATUS_LABEL } from "@/lib/status";
import { getPoDetail } from "@/server/queries/po-detail";

export const metadata: Metadata = { title: "Shipments & Customs" };

export default async function ShipmentsPage({ searchParams }: PageProps<"/shipments">) {
  const user = await requirePermission("view:shipments");
  const sp = await searchParams;
  const view = sp.view === "delivered" ? "delivered" : "active";
  const today = todayIso();
  const shipments = await db.shipment.findMany({
    where: view === "active" ? { actualArrival: null, po: { poStatus: { notIn: ["CANCELLED", "CLOSED"] } } } : { actualArrival: { not: null } },
    include: { po: { select: { number: true, eta: true, shipmentStatus: true, customsStatus: true, supplier: { select: { name: true } } } } },
    orderBy: view === "active" ? [{ eta: { sort: "asc", nulls: "last" } }] : [{ actualArrival: "desc" }],
    take: view === "active" ? 200 : 60,
  });
  const sel = shipments.find((s) => s.id === sp.id) ?? shipments[0];
  const po = sel ? await getPoDetail(sel.po.number, today) : null;
  const inTransit = shipments.filter((s) => s.po.shipmentStatus === "IN_TRANSIT" || s.po.shipmentStatus === "SHIPPED").length;
  const canEdit = can(user.role, "shipment:write");

  return (
    <Page>
      <PageHeader
        title="Shipments & Customs"
        subtitle="Every shipment linked to its purchase order, from supplier dock to Dubai warehouse."
        actions={
          <Segment
            items={[
              { label: "Active", href: "/shipments", active: view === "active" },
              { label: "Delivered", href: "/shipments?view=delivered", active: view === "delivered" },
            ]}
          />
        }
      />
      <div className="flex flex-wrap items-start gap-8">
        <section className="card flex max-h-[calc(100vh-220px)] min-w-[280px] flex-[0_1_380px] flex-col overflow-y-auto">
          <div className="border-b border-line pb-2 text-[12.5px] text-secondary">
            {shipments.length} {view === "active" ? `shipments · ${inTransit} moving` : "delivered shipments"}
          </div>
          {shipments.map((s) => {
            const on = s.id === sel?.id;
            return (
              <Link
                key={s.id}
                href={`/shipments?${view === "delivered" ? "view=delivered&" : ""}id=${s.id}`}
                scroll={false}
                className={`flex flex-col gap-1.5 border-b border-l-4 border-b-neutral-200 p-3 hover:bg-surface ${on ? "border-l-accent bg-surface" : "border-l-transparent"}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <b className="text-[15px]">
                    {s.po.supplier.name} · {s.po.number}
                  </b>
                  <span className="text-[13px] whitespace-nowrap">
                    {s.actualArrival ? "Arrived" : "ETA"} <b>{fmtDate(toIsoDate(s.actualArrival ?? s.eta ?? s.po.eta))}</b>
                  </span>
                </span>
                <span className="text-[13px] text-neutral-800">
                  {s.carrier} · {s.trackingNumber ?? "Awaiting pickup"}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <Pill label={SHIPMENT_STATUS_LABEL[s.po.shipmentStatus]} />
                  <Pill label={`Customs: ${CUSTOMS_STATUS_LABEL[s.po.customsStatus]}`} tone={s.po.customsStatus === "DOCUMENTS_REQUIRED" ? "orange" : s.po.customsStatus === "ON_HOLD" ? "red" : s.po.customsStatus === "CLEARED" ? "green" : s.po.customsStatus === "IN_CLEARANCE" ? "blue" : "gray"} />
                </span>
              </Link>
            );
          })}
          {shipments.length === 0 && <Empty>No {view} shipments. Shipments are created from a purchase order once goods are ready.</Empty>}
        </section>

        {po && (
          <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-[12.5px] text-secondary">Shipment</span>
                <h2 className="text-[26px]">
                  {po.supplier.name} · {po.number}
                </h2>
              </div>
              <Link href={`/orders/${po.number}`} className="btn btn-secondary">
                Open purchase order →
              </Link>
            </div>
            <ShipmentCard po={po} today={today} canShip={canEdit && po.poStatus === "CONFIRMED"} />
            <CustomsCard po={po} canEdit={canEdit && po.poStatus !== "CLOSED" && po.poStatus !== "CANCELLED"} />
          </div>
        )}
        {!po && (
          <Card className="flex-[1_1_640px]">
            <Empty>Select a shipment.</Empty>
          </Card>
        )}
      </div>
    </Page>
  );
}
