/** Stand-in for screens that later build steps replace (see design/CLAUDE_CODE_PROMPTS.md). */
export function PagePlaceholder({ title, subtitle, step }: { title: string; subtitle: string; step: number }) {
  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 md:px-6">
      <h1 className="mb-1.5 text-[28px]">{title}</h1>
      <p className="text-[15px] text-secondary">{subtitle}</p>
      <div className="card mt-8 text-sm text-secondary">This screen is built in step {step} of the build plan.</div>
    </div>
  );
}
