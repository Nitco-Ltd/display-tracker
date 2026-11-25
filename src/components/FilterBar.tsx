"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiSelect } from "./MultiSelect";
import type { FilterOptions } from "@/analytics/data";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

export function FilterBar({ options, extra }: { options: FilterOptions; extra?: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const get = (p: string) => sp.getAll(p);
  const set = (p: string, vals: string[]) => {
    const next = new URLSearchParams(sp.toString());
    next.delete(p);
    next.delete("page");
    for (const v of vals) next.append(p, v);
    start(() => router.push(`${path}?${next.toString()}`, { scroll: false }));
  };
  const o = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));
  const any = [...sp.keys()].some((k) => !["page", "sort", "n"].includes(k));

  const fields: [string, string, { value: string; label: string }[]][] = [
    ["month", "Display month", options.months.map((m) => ({ value: m, label: monthLabel(m) }))],
    ["zone", "Zone", o(options.zones)],
    ["region", "Region", o(options.regions)],
    ["rmi", "RMI", o(options.rmis)],
    ["dealer", "Dealer", options.dealers.map((d) => ({ value: d.code, label: d.name }))],
    ["dtype", "Dealer type", o(options.dtypes)],
    ["ptype", "Product type", o(options.ptypes)],
    ["size", "Size (mm)", o(options.sizes)],
    ["design", "Design", o(options.designs)],
    ["dstatus", "Design status", o(options.dstatuses)],
    ["where", "Displayed where", o(options.wheres)],
  ];

  return (
    <div className={`card p-3 mb-5 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {fields.map(([p, label, opts]) => (
          <MultiSelect key={p} label={label} options={opts} selected={get(p)} onChange={(v) => set(p, v)} />
        ))}
        <MultiSelect
          single
          label="Sales counted"
          options={[
            { value: "excl", label: "Without ZTDN, ZNTI, ZDMS" },
            { value: "incl", label: "With ZTDN, ZNTI, ZDMS" },
          ]}
          selected={get("sales").length ? get("sales") : ["excl"]}
          onChange={(v) => set("sales", v.includes("incl") ? ["incl"] : [])}
        />
        {extra}
      </div>
      {any && (
        <button onClick={() => start(() => router.push(path))} className="mt-2 text-[12px] text-accent">
          Clear all filters
        </button>
      )}
    </div>
  );
}
