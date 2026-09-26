"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Upload, X } from "lucide-react";
import { lineTotal } from "@/lib/domain/totals";
import { fmtDate, usd, usdR } from "@/lib/format";
import { CARRIERS, INCOTERMS } from "@/lib/validation/po";
import { createPo } from "@/server/services/po";

interface CatalogItem {
  productId: string;
  sku: string;
  name: string;
  brandId: string;
  unitPrice: number;
}

export interface WizardData {
  today: string;
  suppliers: {
    id: string;
    name: string;
    country: string;
    currency: string;
    leadTimeDays: number | null;
    onTimeRate: number | null;
    paymentTerms: string;
    incoterm: string;
    brandIds: string[];
    catalog: CatalogItem[];
  }[];
  allProducts: CatalogItem[];
  brands: { id: string; name: string; available: number | null }[];
  initialSupplierId: string | null;
}

interface Line {
  key: number;
  productId: string | null;
  sku: string;
  name: string;
  qty: string;
  price: string;
  disc: string;
  tax: string;
}

const STEPS = ["Supplier", "Products", "Commercial Terms", "Documents", "Review"];
const n = (s: string) => {
  const x = parseFloat(s);
  return Number.isFinite(x) ? x : 0;
};
const addDays = (iso: string, d: number) => new Date(new Date(iso + "T00:00:00Z").getTime() + d * 864e5).toISOString().slice(0, 10);

export function CreatePoWizard({ data }: { data: WizardData }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [supplierId, setSupplierId] = useState<string | null>(data.initialSupplierId);
  const supplier = data.suppliers.find((s) => s.id === supplierId) ?? null;
  const [lines, setLines] = useState<Line[]>([]);
  const nextKey = useRef(1);
  const [terms, setTerms] = useState(supplier?.paymentTerms ?? "");
  const [incoterm, setIncoterm] = useState(supplier?.incoterm ?? "EXW");
  const [currency, setCurrency] = useState(supplier?.currency ?? "USD");
  const lead = supplier?.leadTimeDays ?? 14;
  const [prodDate, setProdDate] = useState(addDays(data.today, Math.max(7, lead - 4)));
  const [shipDate, setShipDate] = useState(addDays(data.today, Math.max(9, lead - 2)));
  const [carrier, setCarrier] = useState<string>(CARRIERS[0]);
  const [notes, setNotes] = useState("");
  const [brandId, setBrandId] = useState<string>(supplier?.brandIds[0] ?? "");
  const [docs, setDocs] = useState<{ file: File; type: "QUOTATION" | "PROFORMA_INVOICE" }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");

  const totals = useMemo(() => {
    const perLine = lines.map((l) => lineTotal({ qty: n(l.qty), unitPrice: n(l.price), discountPct: n(l.disc), taxPct: n(l.tax) }));
    return { perLine, grand: perLine.reduce((a, b) => a + b, 0), units: lines.reduce((a, l) => a + n(l.qty), 0) };
  }, [lines]);

  const linesValid = lines.length > 0 && totals.grand > 0 && lines.every((l) => l.sku.trim().length >= 2 && l.name.trim() && Number.isInteger(n(l.qty)) && n(l.qty) > 0 && n(l.price) >= 0);
  const valid = [!!supplier, linesValid, !!brandId && !!currency && (!prodDate || !shipDate || prodDate <= shipDate), true, true];
  const brand = data.brands.find((b) => b.id === brandId);

  function pickSupplier(id: string) {
    const s = data.suppliers.find((x) => x.id === id)!;
    if (id !== supplierId) {
      setLines([]);
      setTerms(s.paymentTerms);
      setIncoterm(s.incoterm);
      setCurrency(s.currency);
      setBrandId(s.brandIds[0] ?? "");
      const l = s.leadTimeDays ?? 14;
      setProdDate(addDays(data.today, Math.max(7, l - 4)));
      setShipDate(addDays(data.today, Math.max(9, l - 2)));
    }
    setSupplierId(id);
  }

  function addLine(c?: CatalogItem) {
    if (c && !brandId) setBrandId(c.brandId);
    setLines((ls) => [...ls, { key: nextKey.current++, productId: c?.productId ?? null, sku: c?.sku ?? "", name: c?.name ?? "", qty: "1", price: c ? String(c.unitPrice) : "0", disc: "0", tax: "0" }]);
  }
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function submit(send: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        supplierId,
        brandId,
        currency,
        paymentTerms: terms,
        incoterm,
        expectedProductionDate: prodDate,
        expectedShipDate: shipDate,
        carrier,
        notes,
        send,
        lines: lines.map((l) => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty, unitPrice: l.price, discountPct: l.disc, taxPct: l.tax })),
      }),
    );
    for (const d of docs) {
      fd.append("docs", d.file);
      fd.append("docTypes", d.type);
    }
    start(async () => {
      const res = await createPo(fd);
      if (res.ok && res.data) router.push(`/orders/${res.data.number}`);
      else if (!res.ok) setError(res.error + (res.fieldErrors ? " " + Object.values(res.fieldErrors).flat().filter(Boolean).join(" ") : ""));
    });
  }

  const catalog = supplier?.catalog ?? [];
  const others = search.trim().length >= 2 ? data.allProducts.filter((p) => !catalog.some((c) => c.productId === p.productId) && (p.sku + " " + p.name).toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-4 pt-6 pb-16 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-3">
        <div>
          <h1 className="mb-1 text-[28px]">Create Purchase Order</h1>
          <p className="text-[15px] text-secondary">
            {supplier ? `${supplier.name} · ${lines.length} ${lines.length === 1 ? "line" : "lines"} · ${usdR(totals.grand)}` : "Five steps. Nothing is saved until you confirm on Review."}
          </p>
        </div>
        <Link href="/orders" className="btn btn-secondary">
          Cancel
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-2 border-b border-line pb-3">
        {STEPS.map((label, i) => {
          const reachable = i <= step || valid.slice(0, i).every(Boolean);
          return (
            <button key={label} type="button" disabled={!reachable} onClick={() => setStep(i)} className="flex min-w-0 cursor-pointer flex-col gap-1.5 text-left disabled:cursor-not-allowed">
              <span className={`h-[3px] ${i < step ? "bg-ink" : i === step ? "bg-accent" : "bg-neutral-300"}`} />
              <span className="text-xs text-secondary">Step {i + 1}</span>
              <span className={`truncate text-[15px] ${i === step ? "font-bold" : ""} ${i <= step ? "" : "text-neutral-600"}`}>{label}</span>
            </button>
          );
        })}
      </div>

      {step === 0 && (
        <section className="card">
          <h2 className="mb-4 text-lg">Select supplier</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            {data.suppliers.map((s) => {
              const on = s.id === supplierId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSupplier(s.id)}
                  aria-pressed={on}
                  className={`flex flex-col gap-1.5 rounded-tile bg-surface p-3.5 text-left hover:bg-neutral-200 ${on ? "outline-2 outline-accent" : ""}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold">{s.name}</span>
                    <span className={`flex size-4 items-center justify-center border-2 ${on ? "border-accent bg-accent text-white" : "border-ink"}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                  </span>
                  <span className="text-[13px] text-secondary">
                    {s.country} · {s.leadTimeDays ?? "—"} day lead time · {s.onTimeRate ?? "—"}% on time
                  </span>
                  <span className="text-xs text-secondary">{s.paymentTerms || "No terms on file"}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && supplier && (
        <section className="card">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg">Products from {supplier.name}</h2>
            <div className="flex max-w-full flex-wrap gap-2">
              {catalog.map((c) => (
                <button key={c.productId} type="button" onClick={() => addLine(c)} className="btn btn-secondary py-1.5! text-[13px]">
                  + {c.name}
                </button>
              ))}
              <button type="button" onClick={() => addLine()} className="btn btn-ghost py-1.5! text-[13px]">
                + Custom line
              </button>
            </div>
          </div>
          <div className="mb-3 flex max-w-[420px] flex-col gap-1">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input" placeholder="Search the whole catalogue by SKU or name" aria-label="Search catalogue" />
            {others.map((p) => (
              <button key={p.productId} type="button" onClick={() => { addLine(p); setSearch(""); }} className="rounded-lg px-2 py-1 text-left text-[13px] hover:bg-surface">
                + {p.name} <span className="text-secondary">· {p.sku}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid gap-2 border-b border-line py-2 text-[12.5px] text-secondary" style={{ gridTemplateColumns: LINE_COLS }}>
                <span>SKU</span>
                <span>Product</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span>Discount %</span>
                <span>Tax %</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {lines.map((l, i) => (
                <div key={l.key} className="grid items-center gap-2 border-b border-neutral-200 py-2" style={{ gridTemplateColumns: LINE_COLS }}>
                  <input className="input" aria-label="SKU" value={l.sku} readOnly={!!l.productId} onChange={(e) => setLine(l.key, { sku: e.target.value })} />
                  <input className="input" aria-label="Product" value={l.name} readOnly={!!l.productId} onChange={(e) => setLine(l.key, { name: e.target.value })} />
                  <input className="input" aria-label="Quantity" inputMode="numeric" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                  <input className="input" aria-label="Unit price" inputMode="decimal" value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value })} />
                  <input className="input" aria-label="Discount %" inputMode="decimal" value={l.disc} onChange={(e) => setLine(l.key, { disc: e.target.value })} />
                  <input className="input" aria-label="Tax %" inputMode="decimal" value={l.tax} onChange={(e) => setLine(l.key, { tax: e.target.value })} />
                  <span className="text-right font-semibold">{usd(totals.perLine[i])}</span>
                  <button type="button" title="Remove line" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="btn btn-ghost btn-icon">
                    <X size={15} />
                  </button>
                </div>
              ))}
              {lines.length === 0 && <div className="py-6 text-sm text-secondary">No products yet. Add from the supplier catalog above.</div>}
              <div className="flex justify-end gap-6 pt-3 text-sm">
                <span>
                  <span className="text-secondary">Units</span> <b>{totals.units.toLocaleString()}</b>
                </span>
                <span>
                  <span className="text-secondary">PO total</span> <b>{usd(totals.grand)}</b>
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Brand (budget)" value={brandId} onChange={setBrandId} options={data.brands.map((b) => ({ value: b.id, label: b.name }))} />
          <Sel label="Currency" value={currency} onChange={setCurrency} options={["USD", "AED", "EUR", "CNY", "HKD"].map((c) => ({ value: c, label: c }))} />
          <div className="field">
            <label htmlFor="terms">Payment terms</label>
            <input id="terms" className="input" list="term-options" value={terms} onChange={(e) => setTerms(e.target.value)} />
            <datalist id="term-options">
              {["100% before shipment", "100% on order", "50% deposit, 50% before shipment", "30% deposit, 70% before shipment", "50% deposit, balance in 10 days"].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <Sel label="Incoterms" value={incoterm} onChange={setIncoterm} options={INCOTERMS.map((i) => ({ value: i, label: i }))} />
          <div className="field">
            <label htmlFor="prod">Expected production date</label>
            <input id="prod" type="date" className="input" value={prodDate} onChange={(e) => setProdDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ship">Expected shipping date</label>
            <input id="ship" type="date" className="input" value={shipDate} min={prodDate} onChange={(e) => setShipDate(e.target.value)} />
            {prodDate && shipDate && prodDate > shipDate && <p className="mt-1 text-xs text-red-fg">Shipping can’t be before production ends.</p>}
          </div>
          <Sel label="Preferred carrier" value={carrier} onChange={setCarrier} options={CARRIERS.map((c) => ({ value: c, label: c }))} />
          <div className="field sm:col-span-2">
            <label htmlFor="notes">Notes to supplier</label>
            <textarea id="notes" className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Packaging, labelling or firmware requirements" />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card flex flex-col gap-3">
          <h2 className="text-lg">Quotation and proforma invoice</h2>
          <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-tile border-2 border-dashed border-line-input bg-subtle p-8 text-center hover:border-neutral-500">
            <Upload size={20} />
            <span className="font-semibold">Drop files here or browse</span>
            <span className="text-[13px] text-secondary">PDF, XLSX or images up to 20 MB</span>
            <input
              type="file"
              multiple
              className="sr-only"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                setDocs((d) => [...d, ...files.map((file, i) => ({ file, type: (d.length + i === 0 ? "QUOTATION" : "PROFORMA_INVOICE") as "QUOTATION" | "PROFORMA_INVOICE" }))]);
                e.target.value = "";
              }}
            />
          </label>
          {docs.map((d, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-neutral-200 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{d.file.name}</span>
              <select className="input w-auto!" value={d.type} aria-label="Document type" onChange={(e) => setDocs((ds) => ds.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof x.type } : x)))}>
                <option value="QUOTATION">Quotation</option>
                <option value="PROFORMA_INVOICE">Proforma Invoice</option>
              </select>
              <button type="button" className="btn btn-ghost" onClick={() => setDocs((ds) => ds.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-secondary">Optional. You can also upload documents later from the PO page.</p>}
        </section>
      )}

      {step === 4 && supplier && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-2 text-lg">Summary</h2>
            {[
              ["Supplier", supplier.name],
              ["Brand", brand?.name ?? "—"],
              ["Currency", currency],
              ["Payment terms", terms || "—"],
              ["Incoterms", incoterm],
              ["Expected production", prodDate ? fmtDate(prodDate) : "—"],
              ["Expected shipping", shipDate ? fmtDate(shipDate) : "—"],
              ["Carrier", carrier],
              ["Documents", docs.length ? docs.map((d) => (d.type === "QUOTATION" ? "Quotation" : "Proforma Invoice")).join(", ") : "None attached"],
              ["Units", totals.units.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-neutral-200 py-2 text-sm">
                <span className="text-secondary">{k}</span>
                <b className="text-right">{v}</b>
              </div>
            ))}
          </div>
          <div className="card flex flex-col">
            <h2 className="mb-2 text-lg">Lines</h2>
            {lines.map((l, i) => (
              <div key={l.key} className="border-b border-neutral-200 py-2 text-sm">
                <div className="flex justify-between gap-3">
                  <b>{l.name}</b>
                  <b>{usd(totals.perLine[i])}</b>
                </div>
                <span className="text-xs text-secondary">
                  {l.sku} · {n(l.qty).toLocaleString()} × {usd(n(l.price))}
                  {n(l.disc) ? ` · −${n(l.disc)}%` : ""}
                  {n(l.tax) ? ` · +${n(l.tax)}% tax` : ""}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-3 text-lg font-semibold">
              <span>Total</span>
              <span>
                {usd(totals.grand)} {currency !== "USD" && <span className="text-sm text-secondary">{currency}</span>}
              </span>
            </div>
            {brand?.available != null &&
              (totals.grand > brand.available ? (
                <div className="rounded-[10px] bg-red-bg px-3 py-2 text-[13px] font-medium text-red-fg">
                  Exceeds the remaining {brand.name} budget of {usdR(brand.available)} by {usdR(totals.grand - brand.available)}.
                </div>
              ) : (
                <div className="rounded-[10px] bg-green-bg px-3 py-2 text-[13px] font-medium text-green-fg">
                  Within the remaining {brand.name} budget of {usdR(brand.available)}.
                </div>
              ))}
            {brand && brand.available == null && <div className="rounded-[10px] bg-subtle-2 px-3 py-2 text-[13px] text-secondary">No {brand.name} budget set for this year.</div>}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-[10px] bg-red-bg px-3 py-2 text-[13px] font-medium text-red-fg">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <button type="button" className="btn btn-secondary" disabled={step === 0 || pending} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          ← Back
        </button>
        <div className="flex gap-2">
          {step === 4 && (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => submit(false)}>
              Save as draft
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary min-w-[180px] justify-between!"
            disabled={!valid[step] || pending}
            onClick={() => (step === 4 ? submit(true) : setStep((s) => s + 1))}
          >
            {pending ? "Creating…" : step === 4 ? "Create & mark as sent" : "Continue"}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const LINE_COLS = "130px minmax(180px,1fr) 80px 100px 90px 80px 100px 36px";

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = `sel-${label.replace(/\W/g, "")}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
