import { toneFor, type Tone } from "@/lib/status";

const TONE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  green: { bg: "bg-green-bg", fg: "text-green-fg", dot: "bg-green-dot" },
  orange: { bg: "bg-orange-bg", fg: "text-orange-fg", dot: "bg-orange-dot" },
  red: { bg: "bg-red-bg", fg: "text-red-fg", dot: "bg-red-dot" },
  blue: { bg: "bg-blue-bg", fg: "text-blue-fg", dot: "bg-blue-dot" },
  gray: { bg: "bg-gray-bg", fg: "text-gray-fg", dot: "bg-gray-dot" },
};

export const toneClasses = (tone: Tone) => TONE[tone];

/** Status pill with a dot. Tone follows the label unless given. */
export function Pill({ label, tone, className = "" }: { label: string; tone?: Tone; className?: string }) {
  const t = TONE[tone ?? toneFor(label)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-xs whitespace-nowrap ${t.bg} ${t.fg} ${className}`}>
      <span className={`size-1.5 flex-none rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

/** Bold label with a colored dot (health column). */
export function HealthDot({ label, tone }: { label: string; tone?: Tone }) {
  const t = TONE[tone ?? toneFor(label)];
  return (
    <span className="inline-flex items-center gap-[7px] font-semibold whitespace-nowrap">
      <span className={`size-[9px] flex-none rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

/** Plain outlined chip (PO status in tables). */
export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md border border-line-input bg-white px-2 py-0.5 text-xs whitespace-nowrap">{children}</span>;
}

export function Dot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`inline-block size-2 flex-none rounded-full ${TONE[tone].dot} ${className}`} />;
}
