export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="text-[24px] font-semibold tracking-tight mt-0.5">{value}</div>
      {sub && <div className="text-[12px] text-ink-2 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Section({ title, note, children, action }: { title: string; note?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-4 mb-5">
      <div className="flex items-start gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {note && <div className="text-[12px] text-ink-3 mt-0.5 max-w-[900px]">{note}</div>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
