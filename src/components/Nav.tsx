"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/monthly", label: "Monthly sales" },
  { href: "/leaderboards", label: "Rankings" },
  { href: "/zero-sales", label: "Follow-up" },
  { href: "/displays", label: "Displays" },
  { href: "/download", label: "Report" },
];

// Filter pages share the same URL filters, so switching tabs keeps the current selection.
const SHARES_FILTERS = new Set(["/", "/leaderboards", "/zero-sales", "/displays"]);

export function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  return (
    <nav
      className="order-last lg:order-none w-full lg:w-auto flex gap-0.5 text-[13.5px] overflow-x-auto lg:overflow-visible whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1"
      aria-label="Pages"
    >
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        const href = SHARES_FILTERS.has(l.href) && SHARES_FILTERS.has(path) && qs ? `${l.href}?${qs}` : l.href;
        return (
          <Link
            key={l.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 px-3 py-1.5 rounded-full transition-colors duration-200 ${
              active ? "bg-[var(--surface-3)] text-ink font-semibold" : "text-ink-2 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
