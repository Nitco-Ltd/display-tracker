// Customer type, from SAP's Customer Group 2 (A_CustomerSalesArea.AdditionalCustomerGroup2, the "Customer Grp 2"
// column of NITCO's sales register). Agreed with the business owner on 2026-11-26:
//   Total       = every customer (as in the Sales data MIS)
//   Retail only = everyone except Key Accounts (09) and Retail Project accounts (12)
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

/** Groups left out of "Retail only". */
export const NON_RETAIL_GROUPS = new Set(["09", "12"]);

export function isRetailGroup(group: string | null | undefined): boolean {
  return !NON_RETAIL_GROUPS.has(group ?? "");
}

/** customer (10 digits) -> Customer Group 2 code, from the SAP customer master. */
export function customerGroups(): Promise<Map<string, string | null>> {
  return cached("customerGroups", async () => {
    const t = tables();
    const rows = await getDb().select({ c: t.sapCustomer.customer, g: t.sapCustomer.customerGroup }).from(t.sapCustomer);
    return new Map(rows.map((r) => [r.c, r.g]));
  });
}

/** A predicate "is this customer's sale counted?" for the chosen scope. */
export async function customerFilter(retailOnly: boolean): Promise<(customer: string) => boolean> {
  if (!retailOnly) return () => true;
  const groups = await customerGroups();
  return (c) => isRetailGroup(groups.get(c));
}
