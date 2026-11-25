// Page title + one-line explanation, the same on every page.
export function PageHeader({ title, description, children }: { title: string; description: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <div className="flex-1 min-w-[280px]">
        <h1 className="text-[24px] font-semibold tracking-tight leading-tight">{title}</h1>
        <p className="text-[13.5px] text-ink-2 mt-1.5 max-w-[920px] leading-relaxed">{description}</p>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

/** A highlighted one- or two-sentence takeaway. */
export function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-5 flex gap-3 items-start rounded-[14px] border px-4 py-3.5 text-[14px] leading-relaxed"
      style={{ background: "var(--accent-soft)", borderColor: "color-mix(in srgb, var(--accent) 22%, transparent)" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
      </svg>
      <div>{children}</div>
    </div>
  );
}
