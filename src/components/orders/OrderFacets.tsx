"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface Facet {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Dropdown filters that live in the URL. */
export function OrderFacets({ facets }: { facets: Facet[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <div className="grid items-end gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
      {facets.map((f) => (
        <div key={f.key} className="field">
          <label htmlFor={`facet-${f.key}`}>{f.label}</label>
          <select id={`facet-${f.key}`} className="input" value={params.get(f.key) ?? ""} onChange={(e) => set(f.key, e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
