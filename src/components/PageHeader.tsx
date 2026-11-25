// Page title + one-line explanation, the same on every page.
export function PageHeader({ title, description, children }: { title: string; description: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex-1 min-w-[280px]">
        <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
        <p className="text-[13px] text-ink-2 mt-0.5 max-w-[980px]">{description}</p>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

/** A highlighted one- or two-sentence takeaway. */
export function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div className="card px-4 py-3 mb-4 text-[14px] leading-relaxed" style={{ borderLeft: "3px solid var(--accent)" }}>
      {children}
    </div>
  );
}
