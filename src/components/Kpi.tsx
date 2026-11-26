import type { IconName } from "./Icon";

/** A figure card: small uppercase label (with an optional status pill), the figure, a thin bar, one line of context. */
export function Kpi({
  label,
  value,
  sub,
  bar,
  pill,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: IconName; // kept for callers; cards follow NITCO Insights and show no icons
  tone?: "accent" | "green" | "orange";
  bar?: number; // 0..1, drawn as a thin progress bar
  pill?: React.ReactNode;
}) {
  return (
    <div className="card lift px-4 py-3.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="label truncate">{label}</span>
        {pill}
      </div>
      <div className="stat text-[22px] mt-2.5 truncate">{value}</div>
      {bar !== undefined && Number.isFinite(bar) && (
        <div className="h-[5px] rounded-full bg-[var(--surface-3)] overflow-hidden mt-3" aria-hidden>
          <div className="grow-x h-full rounded-full" style={{ width: `${Math.max(1, Math.min(100, bar * 100))}%`, background: "var(--series-1)" }} />
        </div>
      )}
      {sub && <div className="text-[11.5px] text-ink-3 mt-2 truncate">{sub}</div>}
    </div>
  );
}

/** A row of 2–4 Kpi cards that rise in one after another. */
export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="stagger grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">{children}</div>;
}

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
