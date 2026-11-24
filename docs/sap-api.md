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
| 3 | `API_BUSINESS_PARTNER` *(optional)* | `A_Customer` | Check that RMI dealer codes exist in SAP |

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
