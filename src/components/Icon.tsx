// Small line icons (1.75px stroke, rounded, 24px grid), in the spirit of SF Symbols. Inline SVG: no icon library.
const PATHS = {
  displays: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM17 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z",
  rupee: "M7 5h10M7 9h10M14 19 8 13h2a4 4 0 0 0 0-8",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  store: "M4 10v10h16V10M3 6l2-3h14l2 3v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM10 20v-5h4v5",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  filter: "M4 6h16M7 12h10M10 18h4",
  chevron: "m6 9 6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12.5 10 17 19 7",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
