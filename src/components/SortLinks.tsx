"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Small segmented control that sets one URL parameter, keeping the rest (filters). */
export function ParamLinks({ param, options, fallback }: { param: string; options: { value: string; label: string }[]; fallback: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? fallback;
  return (
    <div className="inline-flex rounded-md border border-line overflow-hidden text-[12px]">
      {options.map((o) => {
        const next = new URLSearchParams(sp.toString());
        next.set(param, o.value);
        next.delete("page");
        return (
          <Link
            key={o.value}
            href={`${path}?${next.toString()}`}
            scroll={false}
            className={`px-2.5 py-1 ${current === o.value ? "bg-accent text-white" : "bg-surface-1 text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
