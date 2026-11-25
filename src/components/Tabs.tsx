"use client";
// Tabs over panels that are already rendered on the server: switching is instant (no reload, no data fetch).
// The chosen tab is kept in the URL hash (#tab-id) so a shared link or the back button keeps it.
import { useState, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export interface TabDef {
  id: string;
  label: string;
  hint?: string; // small text under the tabs, e.g. what the tab shows
}

export function Tabs({ tabs, children, small }: { tabs: TabDef[]; children: React.ReactNode[]; small?: boolean }) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => "",
  );
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked ?? (tabs.some((t) => t.id === hash) ? hash : tabs[0]?.id);
  const pick = (id: string) => {
    setPicked(id);
    try {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
    } catch {
      /* ignore */
    }
  };
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active));
  return (
    <div>
      <div role="tablist" className={`seg mb-3 max-w-full overflow-x-auto ${small ? "" : ""}`}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === active} onClick={() => pick(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs[idx]?.hint && <div className="text-[12.5px] text-ink-3 -mt-0.5 mb-3">{tabs[idx].hint}</div>}
      {children.map((c, i) => (
        <div key={tabs[i]?.id ?? i} role="tabpanel" hidden={i !== idx}>
          {c}
        </div>
      ))}
    </div>
  );
}
