import Link from "next/link";

export interface SegmentItem {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/** Segmented control made of links (state lives in the URL). */
export function Segment({ items, className = "" }: { items: SegmentItem[]; className?: string }) {
  return (
    <div className={`seg max-w-full overflow-x-auto ${className}`}>
      {items.map((it, i) => (
        <Link
          key={it.href + it.label}
          href={it.href}
          scroll={false}
          className={`flex items-center gap-2 px-3.5 py-[7px] text-[13px] whitespace-nowrap ${i ? "border-l border-line" : ""} ${it.active ? "bg-ink text-page" : "hover:bg-page"}`}
        >
          {it.label}
          {it.count !== undefined && <b className="font-semibold">{it.count}</b>}
        </Link>
      ))}
    </div>
  );
}
