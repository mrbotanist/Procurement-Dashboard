/** 26px rounded square with a 10px ring. `inverted` for dark backgrounds. */
export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-[26px] flex-none items-center justify-center rounded-[8px] ${inverted ? "bg-white" : "bg-ink"}`}
    >
      <span className={`size-[10px] rounded-full border-2 ${inverted ? "border-ink" : "border-white"}`} />
    </span>
  );
}
