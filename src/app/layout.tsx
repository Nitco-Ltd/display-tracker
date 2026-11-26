import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { NitcoLogo } from "@/components/Logo";
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
    <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="NITCO Display Tracker, home">
      <NitcoLogo height={17} />
      <span className="h-5 w-px bg-[var(--border-strong)]" aria-hidden />
      <span className="font-semibold text-[15px] tracking-[-0.01em]">Display Tracker</span>
    </Link>
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
        <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--surface-0)_78%,transparent)] backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto max-w-[1280px] px-4 md:px-8 h-auto min-h-[56px] py-2 flex flex-wrap items-center gap-x-6 gap-y-2">
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
                        <span className="h-7 w-7 rounded-full text-white text-[11.5px] font-semibold flex items-center justify-center" style={{ background: "linear-gradient(180deg, #8e8e93, #636366)" }}>
                          {initials(viewer.name)}
                        </span>
                        <span className="hidden sm:inline text-[13px] text-ink-2">{viewer.name.split(" ")[0]}</span>
                      </summary>
                      <div className="fade-in absolute right-0 mt-2 w-[240px] card p-2 z-40" style={{ boxShadow: "var(--shadow-lg)", borderRadius: 14 }}>
                        <div className="px-2 py-1.5">
                          <div className="text-[13px] font-medium">{viewer.name}</div>
                          <div className="text-[12px] text-ink-3 truncate">{viewer.id}</div>
                          <div className="text-[12px] text-ink-3 mt-1">
                            {viewer.role === "admin" ? "Admin · all data" : viewer.role === "zonal" ? `Zonal · ${viewer.zone}` : `RMI · ${viewer.rmiName}`}
                          </div>
                        </div>
                        <form action={logout}>
                          <button className="w-full text-left rounded-[8px] px-2 py-1.5 mt-1 text-[13px] hover:bg-surface-2">Sign out</button>
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
        <main className="mx-auto w-full max-w-[1280px] px-4 md:px-8 py-8 flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-[1280px] px-4 md:px-8 pb-8 pt-2 text-[12px] text-ink-3">
          Displays from the RMI app. Sales from SAP. Updated at 10:00, 14:00 and 18:00.
        </footer>
      </body>
    </html>
  );
}
