/** Horizontal progress bar. */
export function Progress({ value, className = "h-2", color = "bg-ink", track = "bg-neutral-200" }: { value: number; className?: string; color?: string; track?: string }) {
  return (
    <span className={`block overflow-hidden rounded ${track} ${className}`}>
      <span className={`block h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </span>
  );
}

/** Two-part stacked bar: purchased (ink) + committed (gray, or accent when hot). */
export function StackedBar({ a, b, hot, className = "h-2 rounded" }: { a: number; b: number; hot: boolean; className?: string }) {
  const pa = Math.max(0, Math.min(100, a * 100));
  const pb = Math.max(0, Math.min(100 - pa, b * 100));
  return (
    <span className={`flex gap-[2px] overflow-hidden bg-neutral-200 ${className}`}>
      <span className="bg-ink" style={{ width: `${pa}%` }} />
      <span className={hot ? "bg-accent" : "bg-neutral-500"} style={{ width: `${pb}%` }} />
    </span>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  display?: string;
  highlight?: boolean;
}

/** Vertical bar chart (monthly spend, purchase history). */
export function BarChart({
  data,
  height = 160,
  maxPct = 82,
  showValues = true,
  color = "bg-ink",
  highlightColor = "bg-blue-dot",
}: {
  data: BarDatum[];
  height?: number;
  maxPct?: number;
  showValues?: boolean;
  color?: string;
  highlightColor?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const cols = { gridTemplateColumns: `repeat(${data.length},minmax(0,1fr))` };
  return (
    <div>
      <div className="grid items-end gap-2 border-b border-line" style={{ ...cols, height }} role="img" aria-label={data.map((d) => `${d.label} ${d.display ?? d.value}`).join(", ")}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-col justify-end gap-1" title={`${d.label}: ${d.display ?? d.value}`}>
            {showValues && <span className="truncate text-[11px] text-secondary">{d.display ?? d.value}</span>}
            <div className={`rounded-t-[4px] ${d.highlight ? highlightColor : color}`} style={{ height: `${(d.value / max) * maxPct}%`, minHeight: d.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid gap-2" style={cols}>
        {data.map((d) => (
          <span key={d.label} className="truncate text-[11px] text-secondary">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Label + bar + value rows (spend by supplier, on-time %, lead time). */
export function HBarRows({ rows, valueWidth = 64 }: { rows: { label: React.ReactNode; value: number; max: number; display: string; color?: string; href?: string }[]; valueWidth?: number }) {
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <div key={i} className="grid items-center gap-3 border-b border-neutral-200 py-2 text-sm last:border-b-0" style={{ gridTemplateColumns: `minmax(90px,140px) 1fr ${valueWidth}px` }}>
          <span className="truncate font-semibold">{r.label}</span>
          <Progress value={r.max ? r.value / r.max : 0} color={r.color ?? "bg-ink"} />
          <b className="text-right">{r.display}</b>
        </div>
      ))}
    </div>
  );
}
