import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { FreshnessBanner } from "@/components/FreshnessBanner";
import { RefreshButton } from "@/components/RefreshButton";
import { getViewer, canAdminister } from "@/auth/viewer";
import { isReadOnly } from "@/lib/config";
import { loginRequired } from "@/auth/session";
import { logout } from "./login/actions";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Display Tracker · NITCO",
  description: "NITCO product displays at dealers, and the SAP sales that follow",
};

export const dynamic = "force-dynamic";

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div
        className="h-8 w-8 rounded-[9px] flex items-center justify-center text-white font-bold text-[15px] tracking-tight"
        style={{ background: "var(--brand)", boxShadow: "var(--shadow-md)" }}
        aria-hidden
      >
        N
      </div>
      <div className="leading-tight">
        <div className="font-semibold text-[15px] tracking-tight">Display Tracker</div>
        <div className="text-[11px] text-ink-3 tracking-wide uppercase">NITCO · RMI × SAP</div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  return (
    <html lang="en-IN" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-[var(--surface-1)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--surface-1)_88%,transparent)]">
          <div className="mx-auto max-w-[1440px] px-4 md:px-6 h-auto min-h-[62px] py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
            <BrandMark />
            {viewer && (
              <>
                <Suspense>
                  <Nav />
                </Suspense>
                <div className="ml-auto flex items-center gap-3">
                  <FreshnessBanner compact />
                  {canAdminister(viewer) && !isReadOnly() && <RefreshButton />}
                  {loginRequired() && (
                    <details className="relative">
                      <summary className="list-none cursor-pointer flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                        <span className="h-7 w-7 rounded-full bg-[var(--accent-soft)] text-accent text-[12px] font-semibold flex items-center justify-center">
                          {initials(viewer.name)}
                        </span>
                        <span className="hidden sm:inline text-[13px] text-ink-2">{viewer.name.split(" ")[0]}</span>
                      </summary>
                      <div className="absolute right-0 mt-2 w-[220px] card p-2 z-40" style={{ boxShadow: "var(--shadow-lg)" }}>
                        <div className="px-2 py-1.5">
                          <div className="text-[13px] font-medium">{viewer.name}</div>
                          <div className="text-[12px] text-ink-3 truncate">{viewer.id}</div>
                          <div className="text-[11px] text-ink-3 mt-1 uppercase tracking-wide">
                            {viewer.role === "admin" ? "Admin · all data" : viewer.role === "zonal" ? `Zonal · ${viewer.zone}` : `RMI · ${viewer.rmiName}`}
                          </div>
                        </div>
                        <form action={logout}>
                          <button className="btn btn-ghost w-full justify-start mt-1">Sign out</button>
                        </form>
                      </div>
                    </details>
                  )}
                </div>
              </>
            )}
          </div>
        </header>
        {viewer && <FreshnessBanner />}
        <main className="mx-auto w-full max-w-[1440px] px-4 md:px-6 py-6 flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-[1440px] px-4 md:px-6 pb-6 text-[12px] text-ink-3">
          Displays from the RMI app · sales from SAP invoices (tiles, sales org 1801) · refreshed daily at 10:00, 14:00 and 18:00
        </footer>
      </body>
    </html>
  );
}
