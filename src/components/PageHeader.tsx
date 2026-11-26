// Page title: a small grey label (the page), a large statement headline, and at most one short line under it.
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-6 mt-2">
      <div className="flex-1 min-w-[280px]">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="headline">{title}</h1>
        {description && <p className="text-[17px] text-ink-2 mt-3 max-w-[760px] leading-snug">{description}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

/** A highlighted one-sentence takeaway. */
export function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-[20px] px-5 py-4 text-[15px] leading-relaxed" style={{ background: "var(--accent-soft)" }}>
      {children}
    </div>
  );
}
