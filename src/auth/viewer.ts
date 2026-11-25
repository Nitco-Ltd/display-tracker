// Who is looking at the dashboard, and what they may see.
//
// On the local PC without AUTH_SECRET: no login; everyone is an admin who sees everything.
// On Vercel (or with AUTH_SECRET set): everyone signs in (src/app/login), and their app_user row decides the scope:
//   - role "rmi":   sees only their own displays     (filter rmiNames = [their RMI name])
//   - role "zonal": sees only their zone              (filter zones = [their zone])
//   - role "admin": sees everything (and can trigger a refresh where the app can reach SAP)
// Every page and API route calls getViewer()/requireViewer() and scopeFilter(), so scoping applies everywhere.
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import type { ReportFilter } from "@/report/filters";
import { loginRequired, readSessionToken, SESSION_COOKIE } from "./session";

export type Role = "admin" | "zonal" | "rmi";

export interface Viewer {
  id: string;
  name: string;
  role: Role;
  zone?: string;
  rmiName?: string;
}

const LOCAL_ADMIN: Viewer = { id: "local", name: "Local user", role: "admin" };

/** The signed-in viewer, or null when sign-in is required and missing/invalid. */
export async function getViewer(): Promise<Viewer | null> {
  if (!loginRequired()) return LOCAL_ADMIN;
  const email = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!email) return null;
  return viewerByEmail(email);
}

export async function viewerByEmail(email: string): Promise<Viewer | null> {
  await ensureSchema();
  const t = tables();
  const [u] = await getDb().select().from(t.appUser).where(eq(t.appUser.email, email.toLowerCase()));
  if (!u || !u.active) return null;
  const role = u.role as Role;
  // A scoped user without a scope sees nothing rather than everything.
  if (role === "zonal" && !u.zone) return null;
  if (role === "rmi" && !u.rmiName) return null;
  return { id: u.email, name: u.name, role, zone: u.zone ?? undefined, rmiName: u.rmiName ?? undefined };
}

/** For pages: the viewer, or a redirect to the sign-in page. */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** Narrows any filter to what this viewer may see. Apply to every query. */
export function scopeFilter(v: Viewer, f: ReportFilter): ReportFilter {
  if (v.role === "zonal") return { ...f, zones: [v.zone ?? "\u0000none"] };
  if (v.role === "rmi") return { ...f, rmiNames: [v.rmiName ?? "\u0000none"] };
  return f;
}

export const canAdminister = (v: Viewer | null) => v?.role === "admin";
