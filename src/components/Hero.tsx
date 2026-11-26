// The dark headline card at the top of a page (as on NITCO Insights' Targets page): a small label, a serif statement,
// one or two lines of context, a ring gauge for the headline share, and a row of supporting figures.
export interface HeroStat {
  label: string;
  value: string;
  sub?: string;
}

function Ring({ share, caption }: { share: number; caption: string }) {
  const p = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0;
  const r = 52;
  return (
    <div className="relative h-[132px] w-[132px] shrink-0" role="img" aria-label={`${Math.round(p * 100)}% ${caption}`}>
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--hero-line)" strokeWidth="9" />
        <circle
          className="ring"
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="#4a86e8"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${p} 1`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[26px] font-semibold tracking-tight leading-none">{Math.round(p * 100)}%</div>
        <div className="text-[10px] mt-1.5 text-center leading-tight" style={{ color: "var(--hero-muted)" }}>
          {caption}
        </div>
      </div>
    </div>
  );
}

export function Hero({
  eyebrow,
  title,
  children,
  share,
  shareCaption,
  stats,
  badge,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  share?: number;
  shareCaption?: string;
  stats: HeroStat[];
  badge?: React.ReactNode;
}) {
  return (
    <section className="hero px-6 md:px-8 pt-6 pb-5 mb-6">
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2.5 text-[10.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--hero-muted)" }}>
            {eyebrow}
            {badge}
          </div>
          <h1 className="serif text-[clamp(26px,3vw,36px)] leading-[1.12] tracking-[-0.01em] mt-3">{title}</h1>
          {children && (
            <div className="text-[12.5px] leading-relaxed mt-3 max-w-[620px]" style={{ color: "var(--hero-muted)" }}>
              {children}
            </div>
          )}
        </div>
        {share !== undefined && <Ring share={share} caption={shareCaption ?? ""} />}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mt-6 pt-4" style={{ borderTop: "1px solid var(--hero-line)" }}>
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--hero-muted)" }}>
              {s.label}
            </div>
            <div className="text-[17px] font-semibold mt-1.5 truncate">{s.value}</div>
            {s.sub && (
              <div className="text-[11px] mt-1 truncate" style={{ color: "var(--hero-muted)" }}>
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
