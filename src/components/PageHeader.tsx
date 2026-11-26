// Page title as on NITCO Insights: a small uppercase trail ("Display Tracker / Rankings"), a serif headline, and at
// most one short line under it.
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
    <div className="flex flex-wrap items-end gap-4 mb-5 mt-1">
      <div className="flex-1 min-w-[280px]">
        {eyebrow && <div className="eyebrow mb-2">Display Tracker / {eyebrow}</div>}
        <h1 className="headline">{title}</h1>
        {description && <p className="text-[12.5px] text-ink-2 mt-2 max-w-[720px] leading-relaxed">{description}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}
