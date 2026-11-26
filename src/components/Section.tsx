// Building blocks for page content: serif group titles, card sections, chart legend items.
/** A serif heading above a group of cards ("This month", "Year to date" on NITCO Insights). */
export function GroupTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 mt-1">
      <h2 className="serif text-[19px] leading-tight">{title}</h2>
      {note && <div className="text-[11.5px] text-ink-3 mt-0.5">{note}</div>}
    </div>
  );
}

export function Section({
  title,
  note,
  children,
  action,
  className = "",
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 mb-6 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-[13.5px] font-semibold">{title}</h2>
          {note && <div className="text-[11.5px] text-ink-3 mt-0.5 max-w-[720px] leading-relaxed">{note}</div>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Legend swatch + label, used above charts. */
export function LegendItem({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: outline ? "inset 0 0 0 1px var(--axis)" : undefined }} aria-hidden />
      {label}
    </span>
  );
}
