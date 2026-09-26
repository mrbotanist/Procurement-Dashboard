import type { Metadata } from "next";
import Link from "next/link";
import { UploadDocDialog } from "@/components/po-detail/dialogs";
import { OrderFacets } from "@/components/orders/OrderFacets";
import { FileChip } from "@/components/ui/FileChip";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import type { DocumentType } from "@/generated/prisma/enums";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const user = await requirePermission("view:documents");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const supplier = typeof sp.supplier === "string" ? sp.supplier : "";
  const type = typeof sp.type === "string" && sp.type in DOCUMENT_TYPE_LABEL ? (sp.type as DocumentType) : null;

  const base = {
    ...(supplier ? { OR: [{ supplierId: supplier }, { po: { supplierId: supplier } }] } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { fileName: { contains: q, mode: "insensitive" as const } },
                { title: { contains: q, mode: "insensitive" as const } },
                { po: { number: { contains: q, mode: "insensitive" as const } } },
                { supplier: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            },
          ],
        }
      : {}),
  };
  const [docs, counts, total, suppliers, openPos] = await Promise.all([
    db.document.findMany({
      where: { ...base, ...(type ? { type } : {}) },
      include: { po: { select: { number: true } }, supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.document.groupBy({ by: ["type"], where: base, _count: true }),
    db.document.count(),
    db.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.purchaseOrder.findMany({ where: { poStatus: { notIn: ["CANCELLED"] } }, select: { id: true, number: true }, orderBy: { orderDate: "desc" }, take: 300 }),
  ]);
  const poCount = await db.purchaseOrder.count({ where: { documents: { some: {} } } });
  const all = counts.reduce((s, c) => s + c._count, 0);
  const qs = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") next.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return s ? `/documents?${s}` : "/documents";
  };
  const cols = "50px minmax(220px,1.6fr) 170px 100px 120px 80px 90px";

  return (
    <Page className="gap-4!">
      <PageHeader
        title="Documents"
        subtitle={`${total} files across ${poCount} purchase orders and ${suppliers.length} suppliers`}
        actions={can(user.role, "document:write") && <UploadDocDialog button={{ label: "Upload document", className: "btn btn-primary" }} suppliers={suppliers} pos={openPos} />}
      />
      <form className="flex flex-wrap items-end gap-3" action="/documents">
        <div className="field flex-[1_1_280px]">
          <label htmlFor="doc-q">Search</label>
          <input id="doc-q" name="q" defaultValue={q} className="input" placeholder="File name, PO number or supplier" />
        </div>
        {supplier && <input type="hidden" name="supplier" value={supplier} />}
        {type && <input type="hidden" name="type" value={type} />}
        <button className="btn btn-secondary">Search</button>
      </form>
      <div className="max-w-[260px]">
        <OrderFacets facets={[{ key: "supplier", label: "Supplier", options: [{ value: "", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))] }]} />
      </div>
      <div className="flex max-w-full flex-wrap self-start overflow-hidden rounded-[10px] border border-line bg-white">
        {[{ key: null as DocumentType | null, label: "All", n: all }, ...counts.sort((a, b) => b._count - a._count).map((c) => ({ key: c.type, label: DOCUMENT_TYPE_LABEL[c.type], n: c._count }))].map((t) => (
          <Link key={t.label} href={qs({ type: t.key })} scroll={false} className={`flex gap-1.5 border-r border-line px-3 py-[7px] text-[13px] last:border-r-0 ${type === t.key ? "bg-ink text-page" : "hover:bg-page"}`}>
            {t.label}
            <b>{t.n}</b>
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto px-5! pt-1.5! pb-2!">
        <div className="min-w-[860px]">
          <div className="grid gap-3 border-b border-line py-2.5 text-[12.5px] text-secondary" style={{ gridTemplateColumns: cols }}>
            <span>Type</span>
            <span>File</span>
            <span>Document</span>
            <span>PO</span>
            <span>Supplier</span>
            <span>Added</span>
            <span />
          </div>
          {docs.map((d) => (
            <div key={d.id} className="grid items-center gap-3 border-b border-neutral-200 py-2.5 text-sm" style={{ gridTemplateColumns: cols }}>
              <FileChip fileName={d.fileName} />
              <a href={`/api/documents/${d.id}`} target="_blank" className="truncate font-semibold hover:underline">
                {d.fileName}
              </a>
              <span className="truncate">{d.title ?? DOCUMENT_TYPE_LABEL[d.type]}</span>
              {d.po ? (
                <Link href={`/orders/${d.po.number}`} className="font-semibold hover:underline">
                  {d.po.number}
                </Link>
              ) : (
                <span className="text-secondary">—</span>
              )}
              <span className="truncate">{d.supplier?.name ?? "—"}</span>
              <span className="text-neutral-800">{fmtDate(toIsoDate(d.createdAt))}</span>
              <a href={`/api/documents/${d.id}?download=1`} className="btn btn-ghost justify-self-start">
                Download
              </a>
            </div>
          ))}
          {docs.length === 0 && <div className="py-10 text-[15px] text-secondary">No documents match.</div>}
        </div>
      </div>
    </Page>
  );
}
