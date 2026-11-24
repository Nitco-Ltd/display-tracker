// Who is looking at the dashboard, and what they may see.
//
// TODAY (local PC): no login; everyone is an admin who sees everything.
//
// LATER (company SSO): replace getViewer() with Microsoft Entra ID sign-in (e.g. Auth.js with the
// "microsoft-entra-id" provider, or MSAL), map the signed-in user to a role, and nothing else changes:
// every page and API route already calls getViewer() and scopeFilter(), so role-based views work everywhere.
//   - role "rmi":   sees only their own displays     (filter rmiNames = [their RMI name])
//   - role "zonal": sees only their zone              (filter zones = [their zone])
//   - role "admin": sees everything, can approve design mappings and trigger a refresh
import type { ReportFilter } from "@/report/filters";

export type Role = "admin" | "zonal" | "rmi";

export interface Viewer {
  id: string;
  name: string;
  role: Role;
  zone?: string;
  rmiName?: string;
}

export async function getViewer(): Promise<Viewer> {
  // Hook for SSO: read the session here.
  return { id: "local", name: "Local user", role: "admin" };
}

/** Narrows any filter to what this viewer may see. Apply to every query. */
export function scopeFilter(v: Viewer, f: ReportFilter): ReportFilter {
  if (v.role === "zonal" && v.zone) return { ...f, zones: [v.zone] };
  if (v.role === "rmi" && v.rmiName) return { ...f, rmiNames: [v.rmiName] };
  return f;
}

export const canAdminister = (v: Viewer) => v.role === "admin";
