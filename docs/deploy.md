# Moving Display Tracker off the PC

Today the app runs on one PC: SQLite file database, daily job from Windows Task Scheduler, dashboard on
`http://localhost:3000`, no login. The code is already structured for a server; this page lists exactly what
changes. **No code has to be rewritten** for option A; option B needs one decision about how the cloud reaches SAP.

## What stays the same everywhere

- One codebase. `npm run daily` (sync + reports), `npm run build` + `npm start` (dashboard).
- All settings in environment variables (same names as `.env.example`).
- `DATABASE_URL` alone picks the database: `file:…` = SQLite, `postgres://…` = Postgres. Tables are created and
  upgraded automatically (migrations in `drizzle/sqlite` and `drizzle/pg`). The Postgres path is covered by
  `tests/postgres.test.ts` (runs the whole pipeline on a real Postgres engine).
- RMI and SAP are each behind one adapter (`src/adapters/rmi.ts`, `src/adapters/sap.ts`).

## The hard constraint: network access to SAP

SAP (S4 PRD, `192.168.81.61:44300`) is only reachable **inside the NITCO network**. Whatever runs the SAP
sync must be inside that network (or connected to it by VPN / SAP Cloud Connector). RMI (`rmi.nitco.in`)
is public. The dashboard itself only needs the database.

---

## Option A: a company server (recommended)

A Windows or Linux VM inside the NITCO network. Everything runs as today.

1. **Install** Node.js 22+ (LTS). Copy the project (or `git clone`), then `npm ci` and `npm run build`.
2. **Database**
   - Small team: keep SQLite (`DATABASE_URL=file:./data/app.db`); back up `data/app.db` nightly.
   - Several users / IT standard: Postgres. Create an empty database, set
     `DATABASE_URL=postgres://user:pass@dbhost:5432/display_tracker` (add `?sslmode=require` if the DB uses TLS).
     Then run `npm run daily` once: it creates the tables and pulls everything (~4 minutes).
     Move Design review decisions from the PC first:
     `npm run decisions -- export decisions.json` (on the PC) → `npm run decisions -- import decisions.json` (on the server).
3. **Settings**: put the variables from `.env.example` in a `.env` file on the server, or in the service's
   environment / a secrets store. Use a dedicated read-only SAP service user and an RMI service account rather
   than personal logins. Copy `certs/sap-prd.pem`.
4. **Run the dashboard as a service** so it survives reboots:
   - Windows: [NSSM](https://nssm.cc) `nssm install DisplayTracker "C:\Program Files\nodejs\npm.cmd" start` with
     the project folder as working directory; or IIS with the HttpPlatformHandler.
   - Linux: a systemd unit running `npm start` in the project folder, `Restart=always`.
5. **Schedule the daily job**: Windows Task Scheduler (`scripts/windows/setup-tasks.ps1 -NoDashboard
   -RunWhetherLoggedOnOrNot`) or Linux cron `0 7 * * * cd /opt/display-tracker && npm run daily`.
6. **HTTPS + a name**: put IIS / nginx in front (`https://displaytracker.nitco.in` → `http://127.0.0.1:3000`).
7. **Reports folder**: set `REPORT_OUTPUT_DIR` to a SharePoint/OneDrive-synced folder or a network share
   (`\\fileserver\Reports\Display Tracker`) that the service account can write to.
8. **Login (SSO)**, before opening it to more people: see "Adding Microsoft Entra ID" below.

## Option B: Vercel + hosted Postgres

Good for access from anywhere without VPN; needs a decision on SAP.

**Split the work:**

| Part | Runs on | Why |
|---|---|---|
| Dashboard | Vercel | `npm run build`; set env vars in the Vercel project |
| Database | Hosted Postgres (Neon, Supabase, Vercel Postgres, Azure Database for PostgreSQL, …) | `DATABASE_URL=postgres://…?sslmode=require` |
| Daily sync (`npm run daily`) | **Inside the NITCO network** (the current PC or a small VM), writing to the hosted Postgres | Vercel can't reach `192.168.81.61` |

So the PC/VM keeps the Task Scheduler job but points `DATABASE_URL` at the hosted Postgres; Vercel only reads.
(Alternative: expose SAP OData through SAP Cloud Connector / BTP or a reverse proxy with IP allow-listing. That's
an IT/SAP-basis project; then the sync could run as a Vercel Cron Job, but note the SAP first load takes
minutes, so it would need to stay incremental.)

**On Vercel, also:**

- **Refresh now**: the button calls `/api/refresh`, which on Vercel can't reach SAP. Either hide it
  (`canAdminister` in `src/auth/viewer.ts`) or change it to trigger the on-prem job.
- **Reports folder**: Vercel has no persistent disk. Monthly reports are still downloadable any time from
  *Download report* (generated on demand). The on-prem job can keep writing files to SharePoint.
- **Function limits**: dashboard pages run in 1–2 seconds; `maxDuration` is set to 600 s only on `/api/refresh`.
- **Login is required** before going public (below). Without it, anyone with the URL sees sales data.

## Adding Microsoft Entra ID (SSO) and roles

The hooks are already in place:

- `src/auth/viewer.ts` → `getViewer()` returns the current user and role. Today it always returns a local admin.
- Every page and API route calls `getViewer()`, and every data query goes through `scopeFilter(viewer, filter)`:
  - `rmi`: sees only their own displays (filter by RMI name)
  - `zonal`: sees only their zone
  - `admin`: sees everything, can use Design review and Refresh now

To switch on SSO:

1. IT registers an app in Entra ID (redirect URL `https://<host>/api/auth/callback/microsoft-entra-id`).
2. Add Auth.js (`next-auth`) with the Microsoft Entra ID provider; protect all routes with Next.js `proxy.ts`.
3. Replace the body of `getViewer()` with: read the session → map the user's email to a role, zone and RMI name
   (e.g. from an Entra group, or a small `users` table: email, role, zone, rmi_name).

No page or report code changes.

## Checklist before go-live

- [ ] Service accounts for RMI and SAP (not personal logins); passwords only in the server's env/secrets.
- [ ] RMI and SAP passwords that were shared during setup have been changed.
- [ ] `npm test` passes on the server (`npm run test`).
- [ ] First `npm run daily` succeeded; dashboard banner shows both syncs green.
- [ ] Design review decisions imported.
- [ ] Backups of the database (Postgres backups, or `data/app.db`).
- [ ] SSO switched on if anyone other than admins can reach the URL.
