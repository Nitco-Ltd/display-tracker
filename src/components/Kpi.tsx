import { Icon, type IconName } from "./Icon";

/** A headline number: small icon + plain label, the big figure, and one short line of context. */
export function Kpi({ label, value, sub, icon, tone = "accent" }: { label: string; value: string; sub?: React.ReactNode; icon?: IconName; tone?: "accent" | "green" | "orange" }) {
  const color = tone === "green" ? "var(--series-3)" : tone === "orange" ? "var(--series-2)" : "var(--accent)";
  return (
    <div className="card lift px-5 py-4.5 min-w-0">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        {icon && (
          <span className="h-7 w-7 rounded-[9px] flex items-center justify-center shrink-0" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
            <Icon name={icon} size={16} />
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <div className="stat text-[30px] mt-3 truncate">{value}</div>
      {sub && <div className="text-[13px] text-ink-3 mt-1.5 truncate">{sub}</div>}
    </div>
  );
}

/** A row of 2–4 Kpi tiles that rise in one after another. */
export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="stagger grid gap-4 grid-cols-2 lg:grid-cols-4 mb-5">{children}</div>;
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
    <section className={`card p-5 md:p-6 mb-5 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
          {note && <div className="text-[13px] text-ink-3 mt-1 max-w-[760px] leading-relaxed">{note}</div>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Legend swatch + label, used under charts. */
export function LegendItem({ color, label, outline }: { color: string; label: string; outline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color, boxShadow: outline ? "inset 0 0 0 1px var(--axis)" : undefined }} aria-hidden />
      {label}
    </span>
  );
}
