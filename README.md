# Display Tracker

Shows whether putting a NITCO tile on display at a dealer leads that dealer to order it.

It combines two systems:

- **RMI app** (rmi.nitco.in): every display an RMI logs (dealer, tile, date, panel, …)
- **SAP** (S4 PRD): NITCO's invoices to that dealer for that tile, month by month

and produces:

1. **A dashboard** at <https://display-tracker.vercel.app> (sign-in required): overview, monthly sales, rankings, follow-up list, every display, and the report download.
2. **The monthly Excel report** "Display Tracker Report", in RMI's layout, with sales from SAP.

Nothing is ever written to RMI or SAP: the app only reads. Dealer sales to end customers are not in SAP; the dealer's orders from NITCO are the measure.

---

## Contents

1. [How it runs](#1-how-it-runs)
2. [Install (once)](#2-install-once)
3. [Settings: the .env file](#3-settings-the-env-file)
4. [First run](#4-first-run)
5. [The dashboard](#5-the-dashboard)
6. [Refresh schedule](#6-refresh-schedule)
7. [Commands](#7-commands)
8. [How the numbers are calculated](#8-how-the-numbers-are-calculated)
9. [Update and deploy](#9-update-and-deploy)
10. [Troubleshooting](#10-troubleshooting)
11. [Where things are](#11-where-things-are)

---

## 1. How it runs

```
RMI app ─┐
         ├─► Mac (sync at 10:00, 14:00, 18:00) ─► data/app.db (SQLite) ─► publish ─► Neon (Postgres) ─► Vercel (website)
SAP ─────┘        on the NITCO network / VPN
```

- **The Mac** does all the work: it reads RMI and SAP, stores everything in `data/app.db`, builds the reports, and copies the tables the website needs to the cloud database. SAP is only reachable inside the NITCO network, so the Mac must be on the office network or VPN at those times.
- **Neon** (Postgres, Singapore) holds the published copy. **Vercel** runs the website and only reads from Neon (`READ_ONLY=1`). SAP and RMI passwords never leave the Mac.
- If the Mac is off, the website keeps showing the last published data; the header shows **Data as of …**, with an amber warning once it is over 30 hours old.

Details: `docs/go-live-vercel.md` (cloud setup), `docs/deploy.md` (moving the sync to a server).

## 2. Install (once)

You need **Node.js 22+** (LTS from <https://nodejs.org>), an **RMI login that can see all zones**, and a **SAP user with read access** to `API_BILLING_DOCUMENT_SRV` and `API_PRODUCT_SRV` (client 100).

```bash
git clone <this repository> "Display Tracker" && cd "Display Tracker"
npm install
```

## 3. Settings: the .env file

All settings and passwords live in `.env` in the project folder (never committed).

```bash
cp .env.example .env
```

Fill in the lines that end in `=`:

| Setting | What to put |
|---|---|
| `RMI_USER`, `RMI_PASS` | RMI login (must see all zones) |
| `RMI_APP_KEY` | RMI's built-in key. See [Troubleshooting](#rmi-app-key) |
| `SAP_USER`, `SAP_PASS` | SAP user and password for client 100 |
| `PUBLISH_DATABASE_URL` | The Neon connection string (direct, not `-pooler`), so the daily job can publish |
| `REPORT_OUTPUT_DIR` | Folder for the monthly Excel files |
| `ALERT_EMAIL_TO`, `SMTP_*` | Optional: who gets an email if the daily run fails |

Everything else is already set for NITCO (SAP address, sales rules). Type values right after `=`, with no quotes.

> Keep `.env` private. If a password was ever shared, change it in RMI/SAP and update `.env`.

## 4. First run

On the office network or VPN:

```bash
npm run daily     # RMI sync → SAP sync → reports → publish (3–4 min the first time, ~1 min after)
npm run dev       # the dashboard on this Mac at http://localhost:3000 (no sign-in locally)
```

## 5. The dashboard

Filters at the top apply to every page and stay in the web address, so a filtered view can be bookmarked or shared. Less-used filters, and the switch that also counts debit notes and samples (ZTDN, ZNTI, ZDMS), are under **More filters**.

| Page | What it's for |
|---|---|
| **Overview** | The share of displays that led to a purchase, the sales that followed, from display to purchase, before vs after, and displays by month. |
| **Monthly sales** | One sales month: all tile sales (same as the Sales data MIS), split into tiles on display, other tiles bought by the same dealers, and dealers without a display. By region and by tile. |
| **Rankings** | Zones, RMIs, dealers and tiles ranked by sales after display or by purchase rate. |
| **Follow-up** | Displays with no purchase within 1/2/3/6/12 months. Excel export. |
| **Displays** | Every display with its status and sales. Excel export has every report column. |
| **Report** | The monthly Display Tracker Report: pick a month and filters, then download. |

**Who sees what.** Admins see everything; a zonal user sees one zone; an RMI sees their own displays. Accounts are managed on the Mac with `npm run users` (see [Commands](#7-commands)) and reach the website at the next publish.

## 6. Refresh schedule

On the Mac (once):

```bash
./scripts/mac/setup-schedule.sh          # runs `npm run daily` at 10:00, 14:00 and 18:00
./scripts/mac/setup-schedule.sh remove   # stop it
```

If the Mac is asleep at a scheduled time, macOS runs the job when it wakes. Logs: `logs/daily-YYYY-MM.log`.

A Windows PC can host the sync instead: `scripts/windows/setup-tasks.ps1` creates the same job in Task Scheduler.

## 7. Commands

| Command | What it does |
|---|---|
| `npm run daily` | Everything the schedule does: RMI sync, SAP sync, reports, publish. |
| `npm run sync:rmi` | Only RMI (~10 s). `-- --catalog` also refreshes RMI's product list. |
| `npm run sync:sap` | Only SAP. `-- --full` re-reads all invoices since March 2025; `-- --probe` tests the connection. |
| `npm run publish` | Copies the dashboard tables (and user accounts) to the cloud database now. |
| `npm run build:report -- --month 2026-08` | Saves one month's report. Without `--month`: every month still inside its 14-month window. |
| `npm run users -- list` | Lists accounts. Also: `add <email> "<Name>" admin \| zonal "<Zone>" \| rmi "<RMI name>"`, `import <file.csv>`, `reset <email>`, `set-password <email> [--show]`, `check <email>`, `disable` / `enable <email>`. Then `npm run publish`. |
| `npm run decisions -- export decisions.json` | Saves the design links decided by hand. `import` loads them. |
| `npm run sap:cert` | Shows SAP's certificate and whether it still matches (see Troubleshooting). |
| `npm test` · `npm run typecheck` · `npm run lint` | Tests (including the whole pipeline on Postgres), type check, lint. |

## 8. How the numbers are calculated

**Report window.** Each display gets its dealer's purchases of its tile from **1 month before** the display month to **12 months after** (14 months). Only months that have started are shown. **Average** = sum of the 14 months ÷ 14, as in RMI's original report.

**Sales (SAP, sales org 1801, domestic tiles).** Same method as NITCO's Sales data MIS (the SAP billing register):

| Invoice type | Counts as |
|---|---|
| ZVDT, ZSCR, ZMAR, S2 | Sale: + quantity, + value |
| ZRTI, S1, S3 | Return / cancellation: − quantity, − value |
| ZCBR, ZCPD, ZCQC | Credit note: − value only |
| ZTDN, ZNTI, ZDMS | Not counted by default; the **More filters → Include debit notes & samples** switch adds them (and every report also comes in an `_incl_ZTDN_ZNTI_ZDMS` version) |
| Everything else (marble, export, stock transfer, pro forma, …) | Ignored |

A line is a tile when its division is 02 or its material code starts with `TI`. Cancelled documents stay in their own month and the cancellation counts on its own date. Month = invoice date. Value = net, **before GST**. Volume = **m²**, from each tile's box size in SAP.

**Tile → SAP code.** RMI stores only the design name and size. The app links it to a SAP code when the name (and if needed the size) points to one product; when it can't decide, SAP sales settle it (the code the displaying dealers bought, or the only one still selling). Otherwise the display isn't linked and gets no sales.

**Same tile, new box.** A tile code ends in two digits for tiles per box plus a serial (`TIGVMPL1200X600NOGL` `02` `160`: 2 tiles a box). When NITCO changes the box, the tile gets a new code (Oyster Blue Onyx `…02160` → `…03021`). Codes count as one tile when both are tile codes with the same design name and are identical up to the trailing number; "Not to use" codes never merge. The daily sync warns if two codes with the same box size both sell, so they can be checked with sales ops.

**Same dealer, several accounts.** SAP accounts with the same GST number and PIN code count as one dealer (NITCO's own depots never). The report's second sheet lists which accounts and codes were counted.

**Dashboard rules.** A display = one dealer + tile + display month (repeats count once). Totals never count the same dealer × tile × month of sales twice. *Led to a purchase* = any purchase in the 12 months after the display month; displays from the current month, and displays whose tile isn't linked, are left out of rates.

## 9. Update and deploy

```bash
git pull
npm install
npm test && npm run typecheck && npm run lint
npx vercel deploy --prod      # the website (Vercel project nitco2/display-tracker)
```

Database changes are applied automatically on the next run. `.vercelignore` keeps `.env`, `data/` and other private folders off Vercel.

**Backup:** everything in `data/app.db` can be pulled again from RMI and SAP, except the design links decided by hand: `npm run decisions -- export decisions-backup.json`.

## 10. Troubleshooting

First look at the banner on the dashboard or the end of `logs/daily-YYYY-MM.log`.

| Message | Meaning and fix |
|---|---|
| `RMI login rejected` | Wrong `RMI_USER` / `RMI_PASS` in `.env`, or the password changed. |
| `RMI Login: HTTP 403 "Unauthorized Company."` | `RMI_APP_KEY` is wrong, or RMI changed it. See below. |
| `RMI … returned an unexpected shape` / `header changed` | RMI's app changed. The app stops instead of saving wrong data; the RMI connection is all in `src/adapters/rmi.ts` and `docs/rmi-api.md`. |
| `EHOSTUNREACH` / `ETIMEDOUT` … `office network or VPN` | SAP isn't reachable. Connect to VPN and run `npm run daily`. |
| `SAP … HTTP 401` / `403` | Wrong or expired SAP password / no read access to the OData services. |
| `server certificate not trusted` | SAP's certificate changed. `npm run sap:cert`, confirm the fingerprint with IT, then `npm run sap:cert -- --save`. |
| `… is open in Excel (or locked)` | Close the report file; the next run rewrites it. |
| A display shows **₹0** | Its design is blank in RMI or not linked to SAP, or the dealer hasn't ordered it. The **Displays** page shows the status. |
| Someone can't sign in | `npm run users -- check <email>` tests a password; `set-password` changes it; then `npm run publish`. |

<a id="rmi-app-key"></a>**Finding RMI_APP_KEY.** Open <https://rmi.nitco.in> in Chrome, press F12, **Sources** tab, page `(index)`, search for `Authtoken`. The value after it is the key (the same for every RMI user).

## 11. Where things are

| Folder / file | Contents |
|---|---|
| `src/adapters/` | The only code that talks to RMI and SAP |
| `src/sync/` | Sync jobs (RMI, SAP, design matching, publish) |
| `src/sales/` | Sales rules: report window, dealer accounts, packaging variants, monthly sales split |
| `src/analytics/` | Dashboard numbers (outcomes, before vs after, rankings) |
| `src/report/` | The Excel report |
| `src/app/`, `src/components/` | The website (Next.js) |
| `src/db/`, `drizzle/` | Database schema and migrations (SQLite and Postgres) |
| `scripts/` | Command-line jobs; `scripts/mac` and `scripts/windows` for the schedule |
| `tests/` | Automated tests |
| `docs/` | Technical documentation |
| `assets/brand/` | The NITCO logo as supplied (the site uses the versions in `public/`) |
| `.env`, `data/`, `logs/`, `reports/`, `reference/` | Private: settings, database, logs, reports, RMI's original report. Never committed. |
