import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { FreshnessBanner } from "@/components/FreshnessBanner";
import { RefreshButton } from "@/components/RefreshButton";
import { getViewer, canAdminister } from "@/auth/viewer";
import { isReadOnly } from "@/lib/config";

export const metadata: Metadata = {
  title: "Display Tracker",
  description: "NITCO product displays at dealers, and the SAP sales that follow",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface-1">
          <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="font-semibold text-[15px] tracking-tight">Display Tracker</div>
            <Suspense>
              <Nav />
            </Suspense>
            <div className="ml-auto flex items-center gap-3">
              <FreshnessBanner compact />
              {canAdminister(viewer) && !isReadOnly() && <RefreshButton />}
            </div>
          </div>
        </header>
        <FreshnessBanner />
        <main className="mx-auto w-full max-w-[1400px] px-4 md:px-6 py-6 flex-1">{children}</main>
      </body>
    </html>
  );
}
