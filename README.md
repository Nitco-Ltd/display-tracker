# Display Tracker

Shows whether putting a NITCO design on display at a dealer leads to more sales of that design.

It combines two systems, automatically, every day:

- **RMI app** (rmi.nitco.in): every display an RMI logs (dealer, design, date, panel, …)
- **SAP** (S4 PRD): that dealer's invoiced sales of that design, month by month

and produces:

1. **The monthly Excel report** "Display Tracker Report", in the same layout as RMI's, with real SAP sales.
2. **A dashboard** in your web browser: overview, before-vs-after, leaderboards, follow-up list, downloads.

Nothing is ever written to RMI or SAP: the app only reads.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Install (once)](#2-install-once)
3. [Settings: the .env file](#3-settings-the-env-file)
4. [First run](#4-first-run)
5. [Use the dashboard](#5-use-the-dashboard)
6. [Run it every day automatically (Windows Task Scheduler)](#6-run-it-every-day-automatically-windows-task-scheduler)
7. [Commands](#7-commands)
8. [How the numbers are calculated](#8-how-the-numbers-are-calculated)
9. [Update to a new version](#9-update-to-a-new-version)
10. [Troubleshooting](#10-troubleshooting)
11. [Where things are](#11-where-things-are)

---

## 1. What you need

- A Windows PC (a Mac works too) that is **on the NITCO office network or VPN** at the time of the daily run. SAP is only reachable from inside the company network.
- **Node.js 22 or newer** (free). Download the "LTS" version from <https://nodejs.org> and install it with the default options.
- An **RMI login that can see all zones**.
- A **SAP user with read access** to the services `API_BILLING_DOCUMENT_SRV` and `API_PRODUCT_SRV` on client 100 (today: `100661`).

## 2. Install (once)

1. Copy the whole project folder to the PC, e.g. to `C:\DisplayTracker`. (Avoid putting the program itself inside OneDrive.)
2. Open **Command Prompt** (Start menu → type `cmd` → Enter) and go to the folder:
   ```bat
   cd /d C:\DisplayTracker
   ```
3. Install the program's parts (takes a few minutes the first time):
   ```bat
   npm install
   ```

## 3. Settings: the .env file

All settings and passwords live in one file called `.env` in the project folder.

1. Make a copy of `.env.example` and name it `.env`:
   ```bat
   copy .env.example .env
   ```
2. Open `.env` in Notepad (`notepad .env`) and fill in the lines that end in `=`:

| Setting | What to put |
|---|---|
| `RMI_USER`, `RMI_PASS` | Your RMI login (must see all zones) |
| `RMI_APP_KEY` | RMI's built-in key. Ask whoever set the app up, or see [Troubleshooting](#rmi-app-key) |
| `SAP_USER`, `SAP_PASS` | SAP user and password for client 100 |
| `REPORT_OUTPUT_DIR` | Folder for the monthly Excel files, e.g. `C:\Users\you\OneDrive - NITCO\Display Tracker Reports` |
| `ALERT_EMAIL_TO`, `SMTP_*` | Optional: who gets an email if the daily run fails, and the mail server to send it |

Everything else is already filled in for NITCO (SAP address, sales rules). Type values right after `=`, with no spaces and no quotes. Save the file.

> Keep `.env` private. Don't email it or paste its passwords into chats. If a password was ever shared, change it in RMI/SAP and update `.env`.

## 4. First run

In Command Prompt, in the project folder (on the office network or VPN):

```bat
npm run daily
```

This pulls everything from RMI and SAP (about 3–4 minutes the first time, ~35 seconds after that) and saves the monthly reports. It ends with a line like:

```
DONE: RMI 12136 rows (12136 new, 0 changed), SAP 387327 invoice lines, 13 reports
```

Then start the dashboard:

```bat
scripts\windows\start-dashboard.cmd
```

The first start builds the app (about a minute). Then open **<http://localhost:3000>** in your browser. Leave the black window open while you use the dashboard; closing it stops the dashboard.

## 5. Use the dashboard

The **filters** at the top (display month, zone, region, RMI, dealer, dealer type, product type, size, design, design status, displayed where) apply to every page and are kept in the web address, so you can bookmark or share a filtered view.

| Page | What it's for |
|---|---|
| **Overview** | Key numbers, **before vs after display** (the main "did displays work?" view), displays per month and the sales that followed. "How these numbers are calculated" is at the bottom. |
| **Leaderboards** | Zones, RMIs, dealers and designs ranked by sales after display or by conversion rate. |
| **Zero sales** | Follow-up list: displays with no sales within 1/2/3/6/12 months. Export to Excel. |
| **Displays** | Every display with all report columns and a sales summary. **Export to Excel** exports exactly what's filtered. |
| **Download report** | The monthly report, like RMI's own report page: pick a month and optional filters, then **Download Excel**. |
| **Design review** | Designs the app couldn't link to a SAP material with certainty. Pick the right material, type a code, or "No match". Your choice is remembered; **Undo** reverses it. Displays get sales only once their design is linked. |

Top right: when RMI and SAP were last synced, and **Refresh now** (pulls the latest data immediately, ~35 seconds). A **red banner** appears if the last sync failed; an **amber banner** if data is more than 30 hours old.

## 6. Run it every day automatically (Windows Task Scheduler)

### Quick way (recommended)

Open **PowerShell** in the project folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\setup-tasks.ps1
```

This creates two tasks in Task Scheduler under **Display Tracker**:

| Task | When | What |
|---|---|---|
| **Daily sync** | Every day at **07:00** | RMI sync → SAP sync → saves the monthly reports. If the PC was off at 07:00, it runs as soon as the PC is back on. Retries twice, 15 minutes apart. |
| **Dashboard** | When you log in to Windows | Starts the dashboard at <http://localhost:3000> |

Options: `-Time "06:30"` for another time, `-NoDashboard` to skip the dashboard task, `-RunWhetherLoggedOnOrNot` to run the sync even when you're logged off (asks for your Windows password once).

### Manual way (Task Scheduler window)

1. Start menu → **Task Scheduler** → **Create Task…** (not "Basic Task").
2. **General**: Name `Display Tracker - Daily sync`. Choose "Run only when user is logged on" (or "whether logged on or not" if the PC stays on overnight).
3. **Triggers** → New → **Daily**, start **7:00:00 AM**, recur every 1 day → OK.
4. **Actions** → New → Program: `cmd.exe`; Arguments: `/c "C:\DisplayTracker\scripts\windows\run-daily.cmd"`; Start in: `C:\DisplayTracker` → OK.
5. **Conditions**: tick "Wake the computer to run this task". Untick "Start only if on AC power" on laptops.
6. **Settings**: tick "Run task as soon as possible after a scheduled start is missed" and "If the task fails, restart every 15 minutes, up to 2 times".
7. OK. To test: right-click the task → **Run**. "Last Run Result" should be `(0x0)`; `(0x1)` means it failed — see the log.

> The daily run needs the **office network or VPN** for SAP. If the VPN isn't connected at 07:00, the SAP part fails, a red banner shows on the dashboard, and the next run (or **Refresh now**) catches up automatically.

## 7. Commands

Run these in Command Prompt in the project folder.

| Command | What it does |
|---|---|
| `npm run daily` | Everything the scheduled job does: RMI sync, SAP sync, monthly reports. Logs to `logs\daily-YYYY-MM.log`. |
| `npm run sync:rmi` | Only the RMI part (~10 seconds). Add `-- --catalog` to also refresh RMI's product list now. |
| `npm run sync:sap` | Only the SAP part. `-- --full` re-reads all invoices since March 2025; `-- --probe` just tests the SAP connection. |
| `npm run build:report` | Saves every monthly report still inside its 14-month window. |
| `npm run build:report -- --month 2026-08` | Saves one month's report (`Display_Tracker_Report_-_Aug-2026.xlsx`). Several: `--month 2026-07,2026-08`. Other folder: `--out "D:\Reports"`. |
| `scripts\windows\start-dashboard.cmd` | Starts the dashboard at <http://localhost:3000>. |
| `npm run sap:cert` | Shows SAP's security certificate and whether it still matches (see Troubleshooting). |
| `npm run decisions -- export decisions.json` | Saves your Design review decisions to a file (to move them to another PC or database). `import` loads them. |

## 8. How the numbers are calculated

**Report window.** Each display gets its dealer's sales of its design from **1 month before** the display month to **12 months after** (14 months). The month headers follow the report's month (Aug-2026 report: Jul-26 … Aug-27).

**Only months that have started are shown** (decided 24 Nov 2026). A report gains one month column each month until its window is complete, e.g. the Sep-2026 report built in Nov-2026 has Aug-26, Sep-26, Oct-26 and Nov-26; from Sep-2027 on it has all 14 months (columns V–AW, the same layout as RMI's report). The daily job rebuilds the reports, so new months appear automatically.

**Average (report).** Avg Sales Volume / Value = **sum of the 14 months ÷ 14**, with months that haven't happened yet counted as 0 (same as RMI's original report). So for a report that isn't complete yet, it is the sum of the months shown ÷ 14. The dashboard also shows an average over elapsed months only.

**Sales (from SAP, sales org 1801, domestic).**

| Invoice type | Counts as |
|---|---|
| ZVDT | Sale: + quantity, + value |
| ZRTI | Return: − quantity, − value |
| ZCBR, ZCPD, ZCQC | Credit note: − value only |
| Everything else (marble, stock transfer, samples, export, cancellations, pro forma, …) | Ignored |

Cancelled invoices are ignored. Month = invoice date. Value = net amount, **before GST**. Volume = **m²**, converted from boxes using each tile's conversion in SAP (e.g. 1 box of 600×1200 = 1.44 m²).

**Design → SAP material.** Each display counts sales of **one** SAP material: its design's own code. Variants of the same design (e.g. "(PO)", "(HW)", "(RPO)") are not added. RMI only stores the design name. The app links it to a SAP material automatically when the name (and, if needed, the size) points to exactly one product; otherwise it goes to **Design review**. Displays with a blank design in RMI can't get sales.

**Dashboard rules.**

- *Display pair* = same dealer + same design + same display month. Two panels of one design count once in rates and averages.
- Totals never count the same dealer × design × month of sales twice, even if it follows several displays.
- *Led to sales* (conversion) = any sales from M+1 onwards. Displays from the current month, and displays whose design isn't linked, are left out of rates.

## 9. Update to a new version

1. Stop the dashboard (close its window).
2. Replace the program files with the new version (keep your `.env`, `data`, `logs` and `certs` folders), or run `git pull` if you use Git.
3. In the project folder:
   ```bat
   npm install
   npm run build
   ```
4. Start the dashboard again. Database changes are applied automatically on the next run.

**Backup:** your data is in `data\app.db`. Everything in it can be pulled again from RMI and SAP, except your **Design review** decisions. Back those up with `npm run decisions -- export decisions-backup.json`.

## 10. Troubleshooting

First look at the **red banner** on the dashboard or the end of `logs\daily-YYYY-MM.log`. Common messages:

| Message | Meaning and fix |
|---|---|
| `RMI login rejected: check RMI_USER / RMI_PASS` | Wrong RMI username/password in `.env`, or the password was changed. Update `.env`. |
| `RMI Login: HTTP 403 "Unauthorized Company."` | `RMI_APP_KEY` is wrong, or RMI changed its key. See below. |
| `RMI … returned an unexpected shape` / `header changed` | The RMI app was changed by its developer (SVIK). The data is safe; the app stops instead of saving wrong data. Needs a developer: the RMI connection is all in `src/adapters/rmi.ts` and `docs/rmi-api.md`. |
| `RMI account is not an admin; it may not see all zones` | The RMI login is limited to a zone. Use an all-zones login. |
| `EHOSTUNREACH` / `ETIMEDOUT` … `connect to the office network or VPN` | SAP isn't reachable. Connect to VPN/office network and click **Refresh now**. |
| `SAP … HTTP 401` | Wrong SAP user/password in `.env`, or the SAP password expired. |
| `SAP … HTTP 403` | The SAP user may not read the OData services. Ask SAP basis to grant read access to `API_BILLING_DOCUMENT_SRV` and `API_PRODUCT_SRV`. |
| `server certificate not trusted` / `CERT_HAS_EXPIRED` | SAP's security certificate changed. Run `npm run sap:cert`, confirm the SHA-256 fingerprint with IT, then `npm run sap:cert -- --save`. |
| `… is open in Excel (or locked). Close it and run again.` | A report file is open. Close it in Excel; the next run (or Refresh now) rewrites it. |
| `SAP not configured yet` (amber) | `SAP_ODATA_BASE_URL` is blank in `.env`. |
| Dashboard shows **0** sales for a display | Its design is blank in RMI or waiting in **Design review**, or the dealer simply hasn't bought it. The **Displays** page shows the SAP material (or why there is none) in the last column. |
| `npm` says EACCES / root-owned cache (Mac) | Run once in Terminal: `sudo chown -R $(id -u):$(id -g) ~/.npm` |

<a id="rmi-app-key"></a>**Finding RMI_APP_KEY.** Open <https://rmi.nitco.in> in Chrome, press F12, open the **Sources** tab, select the page `(index)`, and search (Ctrl+F) for `Authtoken`. The value in quotes after it is the key. It is the same for every RMI user.

**Still stuck?** Developer documentation: `docs/rmi-api.md` (RMI), `docs/sap-api.md` (SAP), `docs/deploy.md` (moving to a server). Every sync is also recorded in the database table `sync_runs` with its error.

## 11. Where things are

| Folder / file | Contents |
|---|---|
| `.env` | Your settings and passwords (private) |
| `data\app.db` | The database (all synced data, your Design review decisions) |
| `reports\` (or `REPORT_OUTPUT_DIR`) | The monthly Excel reports |
| `logs\` | One log file per month from the daily job |
| `certs\sap-prd.pem` | SAP's security certificate (public, not secret) |
| `reference\` | RMI's original Aug-2026 report, used by the automated test |
| `docs\` | Technical documentation |
| `src\adapters\rmi.ts`, `src\adapters\sap.ts` | The only files that talk to RMI / SAP |
