export function Card({
  title,
  aside,
  subtitle,
  children,
  className = "",
  id,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`card flex min-w-0 flex-col ${className}`}>
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3 pb-2">
          <div className="min-w-0">
            {title && <h2 className="text-[17px]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-secondary">{subtitle}</p>}
          </div>
          {aside && <div className="flex-none text-[13px] text-secondary">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Two-column key/value list used in info panels. */
export function InfoList({ rows, keyWidth = 130 }: { rows: { k: string; v: React.ReactNode }[]; keyWidth?: number }) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.k} className="grid gap-3 border-b border-neutral-200 py-2 text-sm last:border-b-0" style={{ gridTemplateColumns: `${keyWidth}px 1fr` }}>
          <span className="text-secondary">{r.k}</span>
          <span className="min-w-0 font-semibold break-words">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-5 text-sm text-secondary">{children}</div>;
}
