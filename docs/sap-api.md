# SAP access request — Display Tracker × SAP Sales

**Purpose:** a read-only tool that adds up each dealer's monthly sales of each tile design, so we can see whether
dealer sales rise after a design goes on display. It **only reads** SAP and never writes, posts or changes anything.

**Status:** requested, not yet tested. Field names are the standard SAP S/4HANA API names; the SAP team should
confirm them against our system.

---

## 1. OData services to activate / grant (read-only, GET only)

| # | Service | Entity sets we read | Why |
|---|---|---|---|
| 1 | `API_BILLING_DOCUMENT_SRV` | `A_BillingDocument`, `A_BillingDocumentItem` | Invoices = the sales figures |
| 2 | `API_PRODUCT_SRV` | `A_Product`, `A_ProductDescription`, `A_ProductUnitsOfMeasure` | Material names (to match RMI designs) and box → sq m conversion |
| 3 | `API_BUSINESS_PARTNER` *(optional)* | `A_Customer` | GST number (`TaxNumber3`) and PIN code (from `CustomerFullName`), to link a dealer's several accounts; weekly |

- **S/4HANA on-premise:** services activated in `/IWFND/MAINT_SERVICE`, plus a technical user whose role
  allows only *display* access to billing documents, products and customers.
- **S/4HANA Cloud:** communication arrangements for Sales Billing Integration (`SAP_COM_0120`) and Product
  Integration (`SAP_COM_0009`), inbound and read-only.

## 2. Fields we read

**`A_BillingDocument` (header)**
`BillingDocument`, `BillingDocumentType`, `SDDocumentCategory`, `BillingDocumentDate`, `SoldToParty`,
`SalesOrganization`, `DistributionChannel`, `Division`, `BillingDocumentIsCancelled`, `CancelledBillingDocument`,
`TransactionCurrency`, `LastChangeDateTime`

**`A_BillingDocumentItem` (lines)**
`BillingDocument`, `BillingDocumentItem`, `Material`, `BillingQuantity`, `BillingQuantityUnit`,
`BillingQuantityInBaseUnit`, `BaseUnit`, `NetAmount`, `TaxAmount`, `TransactionCurrency`, `Plant`

**`API_PRODUCT_SRV`**
`A_Product`: `Product`, `ProductType`, `ProductGroup`, `BaseUnit`
`A_ProductDescription`: `Product`, `Language` (EN), `ProductDescription`
`A_ProductUnitsOfMeasure`: `Product`, `AlternativeUnit`, `QuantityNumerator`, `QuantityDenominator`

## 3. How we will call it (low volume)

- **First load:** invoices with `BillingDocumentDate` ≥ **2025-03-01** (one month before the earliest display),
  fetched in pages of 5,000 with `$select` (only the fields above), `$expand=to_Item`, `$format=json`.
  Example:
  `GET /sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/A_BillingDocument?$filter=BillingDocumentDate ge datetime'2025-03-01T00:00:00' and SalesOrganization eq '<org>'&$select=…&$expand=to_Item&$top=5000&$skip=0&$format=json`
- **Daily (7:00 AM):** only invoices changed since the last run (`LastChangeDateTime ge <last sync>`), plus a full
  re-read of the last 3 months to catch corrections.
- **Products:** full read once a week (tiles only, filtered by `ProductType` / `ProductGroup`).
- Timeouts, at most 3 retries with backoff, one request at a time.

## 4. What we need from the SAP / IT team

1. **Base URL** of the OData gateway (e.g. `https://<host>:<port>/sap/opu/odata/sap/`) and the **SAP client** number.
2. **Login:** a read-only technical user (Basic auth) or OAuth client credentials. Send the password separately,
   not by email or chat; it goes straight into the tool's `.env` file.
3. **Network:** can it be reached from a laptop on the office network? From home over VPN? From a company server later?
4. **Sample:** one response for a recent invoice to dealer `0011000111` (Concrete Concept), with amounts masked if needed.
5. **Scope filters:** which `SalesOrganization` / `DistributionChannel` / `Division` cover domestic tile sales
   to dealers and franchises.
6. **Document types:** which `BillingDocumentType`s are
   - normal sales (e.g. F2),
   - returns / credit memos (e.g. RE, G2),
   - cancellations (e.g. S1, S2),
   - to be ignored (pro forma F5/F8, intercompany, debit memos?).
7. **Units:** is `BillingQuantityUnit` boxes or sq m? Is sq m (M2) maintained as an alternative unit for all tiles?
8. **Value:** is `NetAmount` after all discounts and before GST? Any schemes or rebates booked outside the invoice?

## 5. What we will check once we have access

| Check | Pass condition |
|---|---|
| Dealer code | `SoldToParty` equals RMI's 10-digit `Dealer_Code` (e.g. `0011000111`) |
| Material code | `Material` equals RMI's `ProductCode` (e.g. `TIGVMPL1200X600NOGL02140`) |
| Dealer match rate | % of RMI dealers found in SAP invoices |
| Design match rate | % of displayed designs with an SAP material (target: the 84% RMI matches automatically, plus SAP names for the rest) |
| Month total | One month's total value for the chosen sales org / division equals the sales register finance already trusts (or SAP's billing list, VF05N) |
| Invoice spot-check | 5–10 known invoices for RMI dealers (from the dealers or the sales team) appear with the same dealer, design, quantity and value |

Note: RMI's own Display Tracker Report sales figures are **not** used for validation (known issues, per business owner).

---

## 6. NITCO production setup (confirmed 2026-11-24)

**Connection:** S4 PRD (system PS4), `https://192.168.81.61:44300/sap/opu/odata/sap/`, client 100, office network / VPN only.
The https certificate is self-signed by SAP HEC (`CN=vhntops4ci.sap.nitco.in`); the app trusts exactly that
certificate (`certs/sap-prd.pem`) and checks that name. Services `API_BILLING_DOCUMENT_SRV` and `API_PRODUCT_SRV`
are active on PRD (not on QAS, 192.168.81.88). Read access verified with user `100661`.

**Sales rules (confirmed by the business owner):**

| Setting | Value | Meaning |
|---|---|---|
| `SAP_SALES_ORGS` | `1801` | Domestic (INR). 1802 = export (USD/EUR) is excluded |
| `SAP_SALES_DOC_TYPES` | `ZVDT` | Normal tile invoice → +quantity, +value |
| `SAP_RETURN_DOC_TYPES` | `ZRTI` | Tile return credit note → −quantity, −value |
| `SAP_VALUE_ONLY_DOC_TYPES` | `ZCBR,ZCPD` | Rate-difference / claim credit notes → −value only (ZCQC removed 2026-11-25: the Sales data MIS doesn't include it) |
| everything else | ignored | Marble (ZMAR, ZMRO, ZMBR, ZMRJ), stock transfer (ZSTM), mosaic/services (ZDMO, ZSER, YSER, ZSTF, ZAF1, ZSCR), samples (YDMS), export (ZEXO), cancellations (S1–S3) and pro forma (ZKB, YSTM, YDMS) |

Cancelled invoices (`BillingDocumentIsCancelled`) are always excluded. Month = billing date. Value = `NetAmount`
(before GST). Volume = billed quantity converted to m² with the material's unit conversion (e.g. Marlow Frost
600×1200: 1 box = 1.44 m²).

**First load:** 387,327 lines / 53,578 invoices since 2025-03-01, 24,569 materials, ~2.5 minutes.
300 of 307 RMI dealers found in SAP; SAP material numbers are identical to RMI's product codes.

**Design variants (decided 2026-11-24, amended 2026-11-25):** a display counts sales of its own linked SAP material code
**and its packaging variants**. These are codes that are identical except for the trailing serial number (4–6 digits) and have the same design name
in the material description; the business owner confirmed they are the same tile in different packaging
(`TIGVMPL1200X600NOGL02160` / `…NOGL03021`). RMI's catalogue keeps the old code, while newer invoices use the new one.
Implemented in `src/sales/packaging.ts` (used by the sales window and by design matching, where a design whose candidates are all packaging twins is linked automatically: method `packaging_variants`). Codes that differ elsewhere (`DCH`/`DTL`,
`NO`/`MH`, …) and name variants ("TROPICANA (PO)", "(HW)", "(RPO)") are **not** added. Confirmed by the business owner (2026-11-25): such pairs are different tiles, e.g. Tropicana Caramel `TIDCDTL600X600NOGL04014` vs `TIDCDTM600X600NOGL04001`, Black Beauty `TIGVHGE…02007` vs `TIGVHEP…02001`.

## 7. Independent check against SAP's own analytics (2026-11-24)

SAP's standard query **`C_REVENUEFROMINVOICEQRY`** ("Sales Volume Flexible Analysis", service
`C_REVENUEFROMINVOICEQRY_CDS`, readable by user 100661) was compared with our stored invoice lines for sales org
1801, Aug–Oct 2026, per month and invoice type. SAP's *Net Sales Volume* (cancellations removed, credit notes
negative) equals our not-cancelled totals **to the rupee for all 15 month × type pairs** (ZVDT, ZRTI, ZCBR, ZCPD,
ZCQC). This check is fully independent of RMI.

Not yet compared: NITCO's custom transaction **YCA06** (not published as an OData service; needs an export).

## 8. Reconciliation with YCA06 (NITCO sales register), 1 Aug – 1 Sep 2026

Export provided by the business owner (16,039 lines, sales orgs 1801 + 1802, all divisions).

**Line level (sales org 1801):** all 15,918 YCA06 lines exist in our data with the same invoice, item, customer,
material, invoice type and net value; our m² equals YCA06 "Qty (Sqmt)" on all 6,728 tile lines.
YCA06 sold-to = ship-to on every line. Our extra lines are ₹0 sub-items and types YCA06 omits (ZSTM, YSER, ZSTF).

**Totals, Domestic Tiles, org 1801:** YCA06 ₹36,85,96,322 vs ours (confirmed rules) ₹36,80,26,096; difference
₹5,70,226 (0.15%), fully explained:

| Cause | Amount |
|---|---|
| Types our rules ignore: ZDMS ₹6,42,507, ZTDN ₹3,50,050, ZNTI ₹38,286 | +₹10,30,843 |
| Cancellations: YCA06 lists each original and each cancellation on its own date (S1 −₹16,38,716, S2 +₹2,88,149; later-cancelled ZVDT +₹17,26,776, ZRTI −₹2,95,834, ZCBR −₹5,40,992). We drop cancelled documents and their cancellations entirely, so a cancelled document never moves a month's figure. | −₹4,60,617 |
| **Total** | **₹5,70,226** |

## 9. Reconciliation with the "Sales data" MIS file (tiles, Apr–Oct 2026)

File provided by the business owner: 41,088 invoice lines, division 02 (tiles), sales orgs 1801 + 1802
(207 June lines have a blank sales org; SAP shows them as 1801).

**Line level (1801):** all 37,237 invoice × material lines exist in our data with the same customer, invoice type
and net value. m² is identical except on credit/debit notes (ZCBR, ZCPD, ZTDN, S2), where the file shows 0 m² —
the same as our value-only rule.

**Monthly totals (1801):** file ₹227.85 Cr vs ours ₹227.29 Cr, difference ₹56.15 L (0.25%), every month fully
explained by (A) invoice types our rules ignore — ZDMS, ZTDN, ZNTI, one ZMAR line — ₹52.46 L, and (B) cancellations,
which the file books on each document's own date while we drop cancelled documents — ₹3.69 L.


**Linked dealer accounts (decided 2026-11-25; confirmed that Project Dealer purchases count as the dealer's sales):** a display counts sales billed to any of the dealer's SAP accounts. Accounts are
the same dealer when `A_Customer.TaxNumber3` (GSTIN) **and** the PIN code are equal, excluding NITCO-internal accounts (code
not starting `0011`, or "NITCO" in the name). Example: Shree Shyam Tiles `0011002222` (normal) + `0011007639` (Project Dealer,
created 27 Aug 2026), GSTIN 10COSPP0792L1ZG, PIN 846004. SAP has no customer hierarchy or partner function linking them (checked
`A_CustSalesPartnerFunc`: only self-references). Implemented in `src/sales/dealers.ts`. Sales from the linked accounts are shown
separately on the report's "How sales were matched" sheet. If the customer master can't be read, the sync logs a warning and
sales are counted on the RMI dealer code only.
Confirmed by the business owner (2026-11-25), including groups whose accounts trade under different names: Mahadev
Marbles + Avni Tiles and Granite, Lima Haus + Mahalakshmi Tiles, I Key Home Studio + I Key Tile Gallery, Kiran Paint Sales.

**Undecided invoice types ZNTI, ZDMS (samples), ZTDN (debit notes) (2026-11-25):** not counted in the standard numbers, but kept
apart in `sap_sales_monthly.extra_volume` / `extra_value` (ZNTI, ZDMS: + quantity and value; ZTDN: + value only), set by
`SAP_EXTRA_DOC_TYPES` / `SAP_EXTRA_VALUE_ONLY_DOC_TYPES`. Every report comes in two versions: the standard file and
`…_incl_ZTDN_ZNTI_ZDMS.xlsx`. The dashboard and the download page have a **Sales counted** switch (`?sales=incl`,
`/api/report?extra=1`). When sales ops decides, move the types into `SAP_SALES_DOC_TYPES` (or drop them) in `.env`.
Effect today: after-display sales ₹13.22 Cr → ₹13.23 Cr; converted display pairs 1,630 → 1,722 (mostly ZDMS samples).

**Design review settled from SAP sales (2026-11-25):** a design the name and size can't decide is linked automatically when
SAP sales point at exactly one candidate: `dealer_purchases` (the dealers who displayed it bought exactly one candidate,
counting linked accounts) or `only_one_selling` (they bought none, and only one candidate has sold at all since the first
display). A blank RMI size with exactly one SAP product of that name is linked too. These are re-evaluated on every sync
(after the SAP sync), so they can change as new sales arrive; a decision made by hand (stored as approved/manual/rejected) always wins. (The Design review page was removed on 2026-11-25; the 26 decisions made there are kept.)

**Monthly sales view (2026-11-25), checked against the Sales data MIS:** each customer's zone and region come from SAP
(`A_CustomerSalesArea`, sales org 1801: sales district = zone code, sales office = region office; named like RMI by majority
of RMI dealers per office, e.g. BH1/BH2/BHC → Bihar). All tile sales (division 02, `SAP_TILE_DIVISIONS`) per customer and month
are kept in `sap_customer_monthly`. Aug-2026: Bihar ₹3,61,78,359, Orissa ₹2,00,13,227, Jharkhand ₹37,27,319, East Zone 1
₹5,99,18,906 — identical to the MIS file once ZCQC is excluded (the file has no ZCQC lines; ZCQC was the only difference).
Shown on the page and in the report's Summary sheet as a tree: all sales → dealers without a display / dealers with a
display → …other tiles / …tiles on display at their shop; plus the month's new displays and how much of the newly displayed
tiles they bought (= the report's display-month column). Implemented in `src/sales/funnel.ts`.

**Register method (decided 2026-11-25, matches NITCO's "Book2" SAP extract to the rupee):** cancelled documents are kept in
their own month and the cancellation documents count on their own date (S1 −, S2 +, S3 −; `SAP_INCLUDE_CANCELLED=1`).
ZSCR and ZMAR count as sales, ZCQC reduces value. A line is a tile when its division is 02 or its material is a tile code (TI…)
— one ZMAR tile line is billed under division 05. Sep-2026, all regions, tiles, with ZTDN/ZNTI/ZDMS: ₹36,68,50,225 = Book2.
(This replaces the earlier "drop cancelled documents" and "no ZCQC" rules.)
