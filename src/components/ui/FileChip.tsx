export function FileChip({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "FILE";
  return <span className="inline-block min-w-[34px] flex-none rounded-chip bg-ink px-1.5 py-0.5 text-center text-[10px] font-semibold text-page">{ext}</span>;
}
