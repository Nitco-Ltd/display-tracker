# NITCO RMI API — discovered endpoints

Undocumented internal API of https://rmi.nitco.in (built by SVIK Infotech, ASP.NET + jQuery pages).
Discovered 2026-11-24 by reading the page scripts and calling endpoints with a logged-in session.
Treat everything here as unofficial: it can change without notice.

## Base & auth

- Base path: `https://rmi.nitco.in/api/NitcoRMI/`
- Login: `POST Login`, content-type `application/json`, body
  `{"UserName":"…","Password":"…","platform":1,"latitude":"","longitude":""}`,
  headers `Authtoken: <RMI_APP_KEY>`, `CustomerId: NitcoRMI`.
  - Success: array; `[0].nrmitoken` = bearer token, plus `empid, empcode, empname, franshiseeaccess, franshiseeadmin, zone, zonalmanager`.
  - Failure: the plain string `"invalid"`.
- Every other call: headers `authorization: Bearer <nrmitoken>`, `Authtoken: <RMI_APP_KEY>`, `CustomerID: NitcoRMI`.
- **What the user sees depends on the account.** The web pages restrict zones/RMIs when `zonalmanager=True`
  and show only the user's own RMI unless `franshiseeadmin=True`. The sync account must be admin to get all zones.
- Gotcha: opening the site root (`/`) runs a script that deletes the login cookies (logs the browser out). Irrelevant for API use.

## 1. `POST DisplayTrackerReport` — the monthly report (primary source)

The "Display Tracker Report" page's **Download Excel** button calls this.

- Body (JSON, the app sends it with single quotes; standard JSON also expected to work — verify in adapter):
  `{"month":"8","year":"2026","zone":"","empcode":"","dealercode":"","category":"","size":"","productcode":""}`
  - `month` 1–12 (no padding), `year` YYYY; all other filters blank = everything.
  - Filters map 1:1 to the page dropdowns: zone = `Zone_Code`, empcode = RMI `EmpCode`, dealercode = `KUNNR`,
    category = product type, size = size string, productcode = design `ProductCode`.
  - Page date picker allows months from Jan-2025 to the current month.
- Response: **raw base64 text (not JSON-quoted) of an .xlsx file** (OpenXML SDK output, `x:`-prefixed XML).
  One sheet `Report`, columns A–AY exactly as in the reference report, all cells stored as shared strings
  (numbers are text like `"145.920"`).
- Verified for Aug-2026: 831 rows; 34 rows with any sales; 51 duplicate dealer+design rows;
  `Avg Sales Volume/Value = sum of 14 months ÷ 14` holds on every row. Matches the reference sample.
- **It already contains SAP sales** (Jul-26 … Aug-27 volume/value per dealer + design). RMI's backend does
  the SAP join itself; the join rules (value basis, returns, units) are not visible to us.
- ~150 KB per month. One call per cohort month → ~23 calls per full sync (Jan-2025 → today).

## 2. `POST ExcelDisplayTracker` — Display Tracker List export

Body `{"zone","empcode","displaydate","dealercode","category","size","productcode"}`. Display attributes only,
no sales. Not needed if (1) is used.

## 3. `POST GetDisplayTrackerList` — list (form-encoded)

Filters `zone, empcode, displaydate (MM/DD/YYYY), dealercode, category, size, productcode`.
Returns ~12,100 rows with only 9 fields:
`DisplayTracker_Id, RefrenceNo, DisplayDate, Dealer_Code, Dealer_Name, FranchiseType_Name, Location, RMIName, Status`.

## 4. `GET GetDisplayTrackerDetails/{DisplayTracker_Id}` — one record

Fields: `DisplayTracker_Id, RefrenceNo, Display_Date, DisplayDate, Dealer_Code, Dealer_Name, Dealer_Franchisee,
DealerCategory_Name, Dealer_Status, Project_Incharge, RMIName, Franchisee_Type, FranchiseType_Name,
Displayed_Where, Display_Name, Cassette_Type, Cassette_Type_Name, Cassette_Number, Location, Zone, Zone_Name,
Region, Region_Name, Panel_No, Panel_Size, Product_Type, Product_Type_Name, Size, SizeName, Design_Name,
Design_Code, Design_Category, Design_Size, Design_Count, Design_Status, Status, StatusRemoved_Date, Block,
SubDealerName, Remarks, isImport`.
Note: a record can hold several designs (`Design_Count`); design fields at record level may be null. The report
expands to one row per design. Per-row calls (12k) — avoid; only needed if we want `Design_Code` or zone/region codes.

## Full-data test (2026-11-24)

| Call | Rows | Time | Size |
|---|---|---|---|
| `GetDisplayTrackerList` (all blank) | 12,136 | ~1 s | small JSON |
| `ExcelDisplayTracker` (all blank) | 12,136 | ~4 s | ~940 KB xlsx, columns A–U only |
| `DisplayTrackerReport` × 23 months (Jan-2025 → Nov-2026) | 12,135 | ~60 s total | ~150 KB/month |

- Per-month report row counts equal the list's per-month counts exactly. The one missing row is
  `SZ1/KT/4` (Id 4), dated **05 Feb 2029** (typo), which no monthly report reaches; `ExcelDisplayTracker` still has it.
- Standard JSON bodies (`JSON.stringify`) are accepted, not just the page's single-quoted form.
- **Parser note:** the xlsx omits empty cells, so cells must be placed by their `r` reference (e.g. `K12`), never by position.
- Product Type labels have case variants ("Ceramic wall" / "Ceramic Wall", "Full body vitrified" / "Full Body Vitrified") → normalize.

## Sync plan — DECIDED 2026-11-24: display data from RMI, **sales from SAP directly**

RMI's `DisplayTrackerReport` (which embeds SVIK's own SAP join) is NOT used for sales; it stays only as a
cross-check tool.

1. `GetDisplayTrackerList` (1 call, ~1 s) → every record ID + status; detects new / removed records.
2. `ExcelDisplayTracker` (1 call, ~4 s) → all 21 display columns for all rows. Needed because the list has
   only 9 fields and no "last modified" field, so edits to existing records are only visible here.
3. Product catalogue (weekly, 26 calls): `GetCategoryProductType` → `GetCategorySize/{cat}` →
   `GetCategoryProducts/{cat}/{size}` → 1,051 products (`ProductCode`, `ProductName`, category, size).
4. Upsert into `rmi_display` keyed by Sequence No (`RefrenceNo`); keep raw files for debugging.
5. Map each row's Design Name (+ size) → `ProductCode` (see below), then join SAP sales on dealer code + material.
6. Dashboard and report download filter our own DB, so filtering is instant and puts no load on RMI.

## Design → product code match (all 12,136 rows, 2026-11-24)

Rule tested: normalized design name (lowercase, punctuation stripped) = catalogue `ProductName`;
if several codes share the name, pick the one whose size matches (orientation-insensitive, 600x300 = 300x600).

| Outcome | Rows | % |
|---|---|---|
| Unique name match | 8,783 | 72.4% |
| Several codes, resolved by size | 1,443 | 11.9% |
| Several codes, still ambiguous | 1 | 0.0% |
| Name not in catalogue | 871 | 7.2% (300 distinct names) |
| Design Name blank | 1,038 | 8.6% |

→ **84% of all rows / 92% of rows with a design name map automatically.**
Most unmatched names end in " - N" (e.g. "Silk Peach Onyx - N", "Carara Gold - N") or are older designs
(e.g. "Sakura Blu", "BELGIUM GREY"): the RMI catalogue seems to hold only current products. Plan: match these
against the SAP material master descriptions, and put low-confidence matches in `design_material_map` for review.
Open: why 1,038 rows have no design (possibly multi-design records, `Design_Count` > 1, in the detail API).
Assumption to verify: `ProductCode` (e.g. `TIGVMPL1200X600NOGL02140`) = SAP material number (MATNR).

## Lookups (all GET)

| Endpoint | Returns |
|---|---|
| `GetZoneList` | `Zone_Code, Zone_Name` |
| `GetRMIList` | `EmpCode, EmpName, Zone_Code` |
| `GetDealerZoneWiseList/{zone or all}` | `KUNNR, NAME` (3,015 dealers; `KUNNR` = SAP customer no.) |
| `GetCategoryProductType` | `Category` |
| `GetCategorySize/{category}` | `Size` |
| `GetCategoryProducts/{category}/{size}` | `ProductCode, ProductName` — e.g. `TIGVMPL1200X600NOGL02140` / `Aeon Armani - G` (looks like the SAP material number) |

## Report column → source field

| Report column | DisplayTrackerReport | Detail API field |
|---|---|---|
| Sequence No | A | RefrenceNo |
| Product Display Date | B | DisplayDate |
| RMI Name | C | RMIName |
| Dealer Code | D | Dealer_Code (= SAP KUNNR) |
| Dealer Name | E | Dealer_Name |
| Dealer Status | F | Dealer_Status |
| Zone | G | Zone_Name |
| Region | H | Region_Name |
| Location | I | Location |
| Dealer / Franchise | J | DealerCategory_Name |
| Franchise Type | K | FranchiseType_Name |
| Displayed Where | L | Display_Name |
| Cassette Type | M | Cassette_Type_Name |
| Cassette Number | N | Cassette_Number |
| Panel No | O | Panel_No |
| Panel Size | P | Panel_Size |
| Product Type | Q | Product_Type_Name |
| Size (MM) | R | SizeName |
| Design Name | S | Design_Name |
| Design Status | T | Design_Status |
| Status | U | Status |
| 14 × Sales Volume/Value | V–AW | — (SAP, joined by RMI backend) |
| Avg Sales Volume/Value | AX–AY | — (sum ÷ 14) |

Observed values (Aug-2026): Displayed Where = Cassettee / Tile Stand / Slanter / MockUp; Cassette Type includes the
typo "Horizotal 45 Degree"; Panel Size has ~33 spellings (8x4, 8  X  4, 8 H x 4 W, 1200 x 2400 mm, 0, blank…).
