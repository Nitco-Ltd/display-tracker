# Display Tracker

**Does putting a NITCO tile on display at a dealer make that dealer order it?**

Display Tracker answers that by joining two systems:

| Source | What it gives |
|---|---|
| **RMI app** (rmi.nitco.in) | Every display an RMI puts up: dealer, tile, date, panel |
| **SAP** (S4 PRD) | NITCO's invoices to that dealer for that tile, month by month |

**Live:** <https://display-tracker.vercel.app> (sign-in required)

It only reads RMI and SAP; it never writes to them.

---

## How it works

```
RMI ─┐
     ├─► Mac (syncs at 10:00, 14:00, 18:00) ─► publish ─► Neon database ─► Vercel website
SAP ─┘   on the NITCO network / VPN
```

- **The Mac** fetches RMI and SAP, builds the Excel reports, and publishes to the cloud. SAP and RMI passwords stay on the Mac.
- **The website** only reads the published copy. If the Mac is off, it shows the last data with a **Data as of …** date.

## What's on the website

| Page | Answers |
|---|---|
| **Overview** | What share of displays led to a purchase, and how much was bought afterwards? |
| **Monthly sales** | Of one month's tile sales, how much was a tile on display at that dealer? |
| **Rankings** | Which zones, RMIs, dealers and tiles do best after a display? |
| **Follow-up** | Which displays haven't led to a purchase yet? (Excel export) |
| **Displays** | Every display with its status and sales (Excel export) |
| **Report** | The monthly Display Tracker Report in RMI's Excel layout |

Admins see everything, zonal users see their zone, RMIs see their own displays.

## Key rules

- **A display** = one dealer + one tile + one month. Repeats count once.
- **"Led to a purchase"** = the dealer ordered that tile within 12 months after the display month.
- **Sales** follow NITCO's Sales data MIS (SAP billing register), before GST.
- **Total · Retail** (switch on every page): Total = Retail + Key Accounts + Export. Retail leaves out Key Accounts (SAP Customer Group 2 = 09) and export (sales org 1802, Master Zone PZ). Matches NITCO's monthly Retail / Key / Export summary.
- **With · Without project dealers:** "without" leaves out invoice lines from storage locations (SLoc) F-KA and S-KA.
- **Same tile, new box:** codes that differ only in the box/serial number (e.g. Oyster Blue Onyx `…02160` → `…03021`) count as one tile.
- **Same dealer, several accounts:** SAP accounts with the same GST number and PIN code count as one dealer.

Full detail: [docs/operations.md](docs/operations.md#how-the-numbers-are-calculated).

## Quick start (on the sync Mac)

You need Node.js 22+, an all-zones RMI login, and a read-only SAP user.

```bash
npm install
cp .env.example .env              # then fill in the RMI, SAP and database settings
npm run daily                     # sync RMI + SAP, build reports, publish
./scripts/mac/setup-schedule.sh   # run it automatically at 10:00, 14:00, 18:00
npm run dev                       # optional: the dashboard locally at http://localhost:3000
```

## Everyday tasks

| Task | Command |
|---|---|
| Refresh the data now | `npm run daily` |
| Give someone access | `npm run users -- add <email> "<Name>" admin` then `npm run publish` |
| Change a password | `npm run users -- set-password <email>` then `npm run publish` |
| Deploy a code change | `npm test && npx vercel deploy --prod` |

## Documentation

| Doc | For |
|---|---|
| [docs/operations.md](docs/operations.md) | All commands, how the numbers are calculated, troubleshooting |
| [docs/go-live-vercel.md](docs/go-live-vercel.md) | Cloud setup (Neon, Vercel, users) |
| [docs/deploy.md](docs/deploy.md) | Moving the sync from the Mac to a server |
| [docs/rmi-api.md](docs/rmi-api.md), [docs/sap-api.md](docs/sap-api.md) | How the app reads RMI and SAP |

## Project layout

```
src/adapters/    the only code that talks to RMI and SAP
src/sync/        sync jobs, tile matching, publish
src/sales/       sales rules (report window, dealer accounts, packaging)
src/analytics/   dashboard numbers
src/report/      the Excel report
src/app/         website pages · src/components/ UI pieces
scripts/         command-line jobs and schedules
tests/           automated tests (npm test)
```

Private and never committed: `.env`, `data/`, `logs/`, `reports/`, `reference/`.
