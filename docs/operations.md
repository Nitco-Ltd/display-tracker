# Operations guide

The detail behind the README: every command, exactly how the numbers are calculated, updating, and troubleshooting.

## Commands

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

## How the numbers are calculated

**Report window.** Each display gets its dealer's purchases of its tile from **1 month before** the display month to **12 months after** (14 months). Only months that have started are shown. **Average** = sum of the 14 months ÷ 14, as in RMI's original report.

**Sales (SAP, sales org 1801, domestic tiles).** Same method as NITCO's Sales data MIS (the SAP billing register):

| Invoice type | Counts as |
|---|---|
| ZVDT, ZSCR, ZMAR, S2, ZEXO (export) | Sale: + quantity, + value |
| ZRTI, S1, S3 | Return / cancellation: − quantity, − value |
| ZCBR, ZCPD, ZCQC | Credit note: − value only |
| ZTDN, ZNTI, ZDMS | Not counted by default; the **More filters → Include debit notes & samples** switch adds them (and every report also comes in an `_incl_ZTDN_ZNTI_ZDMS` version) |
| Everything else (marble, export, stock transfer, pro forma, …) | Ignored |

A line is a tile when its division is 02 or its material code starts with `TI`. Cancelled documents stay in their own month and the cancellation counts on its own date. Month = invoice date. Value = net, **before GST**. Volume = **m²**, from each tile's box size in SAP.

**Tile → SAP code.** RMI stores only the design name and size. The app links it to a SAP code when the name (and if needed the size) points to one product; when it can't decide, SAP sales settle it (the code the displaying dealers bought, or the only one still selling). Otherwise the display isn't linked and gets no sales.

**Same tile, new box.** A tile code ends in two digits for tiles per box plus a serial (`TIGVMPL1200X600NOGL` `02` `160`: 2 tiles a box). When NITCO changes the box, the tile gets a new code (Oyster Blue Onyx `…02160` → `…03021`). Codes count as one tile when both are tile codes with the same design name and are identical up to the trailing number; "Not to use" codes never merge. The daily sync warns if two codes with the same box size both sell, so they can be checked with sales ops.

**Total · Retail.** *Total* = Retail + Key Accounts + Export, as NITCO's monthly Retail / Key / Export summary. *Retail* leaves out customers whose SAP Customer Group 2 is **09 Key Account**, and export customers (sales org **1802**, Master Zone PZ). Export invoices (ZEXO) in USD/EUR are converted to rupees at each invoice's own exchange rate. Checked against the Apr–Oct 2026 summary: every month within 0.5% in value and sq m.

**With · Without project dealers.** *Without* leaves out invoice lines whose storage location (SLoc) is **F-KA** or **S-KA** (`SAP_PROJECT_STORAGE_LOCATIONS`). Returns come back into SLoc RMRN, so they stay in, exactly as filtering the register's SLoc column.

**Cancellations.** A cancellation document (S1/S2/S3) counts in the same bucket as the document it cancels, with the opposite sign: a cancelled invoice reduces sales; a cancelled ZTDN debit note only affects the "incl. debit notes & samples" figure.

**Same dealer, several accounts.** SAP accounts with the same GST number and PIN code count as one dealer (NITCO's own depots never). The report's second sheet lists which accounts and codes were counted.

**Dashboard rules.** A display = one dealer + tile + display month (repeats count once). Totals never count the same dealer × tile × month of sales twice. *Led to a purchase* = any purchase in the 12 months after the display month; displays from the current month, and displays whose tile isn't linked, are left out of rates.

## Update and deploy

```bash
git pull
npm install
npm test && npm run typecheck && npm run lint
npx vercel deploy --prod      # the website (Vercel project nitco2/display-tracker)
```

Database changes are applied automatically on the next run. `.vercelignore` keeps `.env`, `data/` and other private folders off Vercel.

**Backup:** everything in `data/app.db` can be pulled again from RMI and SAP, except the design links decided by hand: `npm run decisions -- export decisions-backup.json`.

## Troubleshooting

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

## Where things are

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
