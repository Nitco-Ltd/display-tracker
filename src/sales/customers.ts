// Customer type, from SAP's Customer Group 2 (A_CustomerSalesArea.AdditionalCustomerGroup2, the "Customer Grp 2"
// column of NITCO's sales register). Agreed with the business owner on 2026-11-26, and checked against NITCO's
// monthly Retail / Key / Export summary (Apr–Oct 2026):
//   Total  = Retail + Key Accounts + Export (as NITCO's monthly Retail / Key / Export summary)
//   Retail = everyone except Key Accounts (09) and export customers (sales org 1802, Master Zone PZ)
// Project dealers are a separate switch, by invoice storage location (F-KA / S-KA), not by customer group.
import { getDb, tables } from "@/db/client";
import { cached } from "@/lib/datacache";

export const CUSTOMER_GROUP_NAMES: Record<string, string> = {
  "02": "Le Studio Express",
  "03": "Nitco Look",
  "04": "Galore",
  "05": "Multi Brand Outlet",
  "07": "One Time Customer",
  "08": "Others",
  "09": "Key Account",
  "10": "Retail",
  "12": "Retail Project",
};

/** Groups left out of "Retail". */
export const NON_RETAIL_GROUPS = new Set(["09"]);

export function isRetailGroup(group: string | null | undefined): boolean {
  return !NON_RETAIL_GROUPS.has(group ?? "");
}

export interface CustomerType {
  group: string | null; // Customer Group 2 code
  market: string | null; // "domestic" | "export"
}

export function isRetail(t: CustomerType | undefined): boolean {
  return isRetailGroup(t?.group) && t?.market !== "export";
}

/** customer (10 digits) -> Customer Group 2 and market, from the SAP customer master. */
export function customerTypes(): Promise<Map<string, CustomerType>> {
  return cached("customerTypes", async () => {
    const t = tables();
    const rows = await getDb().select({ c: t.sapCustomer.customer, group: t.sapCustomer.customerGroup, market: t.sapCustomer.market }).from(t.sapCustomer);
    return new Map(rows.map((r) => [r.c, { group: r.group, market: r.market }]));
  });
}

/** A predicate "is this customer's sale counted?" for the chosen scope. */
export async function customerFilter(retailOnly: boolean): Promise<(customer: string) => boolean> {
  if (!retailOnly) return () => true;
  const types = await customerTypes();
  return (c) => isRetail(types.get(c));
}
