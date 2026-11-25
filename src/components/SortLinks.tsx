"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Small segmented control that sets one URL parameter, keeping the rest (filters). */
export function ParamLinks({ param, options, fallback }: { param: string; options: { value: string; label: string }[]; fallback: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? fallback;
  return (
    <div className="seg">
      {options.map((o) => {
        const next = new URLSearchParams(sp.toString());
        next.set(param, o.value);
        next.delete("page");
        return (
          <Link
            key={o.value}
            href={`${path}?${next.toString()}`}
            scroll={false}
            data-active={current === o.value}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
