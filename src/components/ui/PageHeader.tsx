import Link from "next/link";

export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto flex max-w-[1480px] flex-col gap-6 px-4 pt-6 pb-16 md:px-6 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  large = false,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  large?: boolean;
}) {
  return (
    <>
      {back && (
        <Link href={back.href} className="btn btn-ghost -mb-2 self-start px-1!">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-3">
        <div className="min-w-0">
          <h1 className={`mb-1 ${large ? "text-[34px]" : "text-[28px]"}`}>{title}</h1>
          {subtitle && <div className="text-[15px] text-secondary">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </>
  );
}

/** Row of big numbers under a page header. */
export function StatRow({ stats, size = 32, min = 160 }: { stats: { k: string; v: React.ReactNode; tone?: string }[]; size?: number; min?: number }) {
  return (
    <div className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))` }}>
      {stats.map((s) => (
        <div key={s.k} className="flex flex-col gap-1 pr-4 pb-4">
          <span className="text-[12.5px] text-secondary">{s.k}</span>
          <span className={`font-semibold tracking-[-0.02em] ${s.tone ?? ""}`} style={{ fontSize: size }}>
            {s.v}
          </span>
        </div>
      ))}
    </div>
  );
}
