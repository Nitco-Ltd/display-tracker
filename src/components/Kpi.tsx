export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="text-[26px] font-semibold tracking-tight mt-1 leading-none">{value}</div>
      {sub && <div className="text-[12px] text-ink-2 mt-1.5">{sub}</div>}
    </div>
  );
}

export function Section({ title, note, children, action }: { title: string; note?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5 mb-5">
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="flex-1 min-w-[280px]">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {note && <div className="text-[12.5px] text-ink-3 mt-1 max-w-[900px] leading-relaxed">{note}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  );
}
