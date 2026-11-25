"use client";
import { useEffect, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  single = false,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  const toggle = (v: string) => {
    if (single) {
      onChange(selected[0] === v ? [] : [v]);
      setOpen(false);
    } else onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="field" data-active={selected.length > 0 || open} aria-expanded={open}>
        <span className="block text-[11px] font-medium text-ink-3 leading-none mb-1">{label}</span>
        <span className={`block truncate ${selected.length ? "text-ink font-medium" : "text-ink-2"}`}>{summary}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 w-[300px] max-w-[90vw] card p-2" style={{ boxShadow: "var(--shadow-lg)" }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] mb-2 outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-[280px] overflow-auto">
            {shown.map((o) => (
              <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 text-[13px] cursor-pointer accent-[var(--accent)]">
                <input type={single ? "radio" : "checkbox"} checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
            {!shown.length && <div className="text-[12px] text-ink-3 px-1.5 py-2">No matches</div>}
          </div>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-2 text-[12px] text-accent">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
