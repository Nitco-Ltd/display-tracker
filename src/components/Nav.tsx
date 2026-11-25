"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/zero-sales", label: "Zero sales" },
  { href: "/displays", label: "Displays" },
  { href: "/download", label: "Download report" },
];

// Filter pages share the same URL filters, so switching tabs keeps the current selection.
const SHARES_FILTERS = new Set(["/", "/leaderboards", "/zero-sales", "/displays"]);

export function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  return (
    <nav className="flex flex-wrap gap-1 text-[13px]">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        const href = SHARES_FILTERS.has(l.href) && SHARES_FILTERS.has(path) && qs ? `${l.href}?${qs}` : l.href;
        return (
          <Link
            key={l.href}
            href={href}
            className={`px-3 py-1.5 rounded-md ${active ? "bg-surface-0 text-ink font-semibold" : "text-ink-2 hover:text-ink hover:bg-surface-0"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
