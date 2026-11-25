// Linked dealer accounts: one shop, several SAP customer accounts.
//
// A dealer often has a normal account and a second one (e.g. a "Project Dealer" account), and invoices go to either.
// RMI records a display under one of them only. Rule (agreed 2026-11-25): SAP accounts are the same dealer when they have
//   - the same GST number (TaxNumber3 in the SAP customer master), AND
//   - the same PIN code,
// and none of them is a NITCO-internal account (code not starting 0011, or "NITCO" in the name: NITCO's own depots and
// Le Studio stores share NITCO's GST numbers). Example: Shree Shyam Tiles 0011002222 + 0011007639 (GST 10COSPP0792L1ZG, 846004).
import { getDb, tables } from "@/db/client";

export interface CustomerFacts {
  customer: string;
  name: string | null;
  gstin: string | null;
  postalCode: string | null;
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

export function isInternalAccount(c: Pick<CustomerFacts, "customer" | "name">): boolean {
  return !c.customer.startsWith("0011") || /nitco/i.test(c.name ?? "");
}

/** Key shared by accounts of the same dealer, or null if the account can't be linked. */
export function dealerLinkKey(c: CustomerFacts): string | null {
  const gst = c.gstin?.trim().toUpperCase();
  const pin = c.postalCode?.trim();
  if (!gst || !GSTIN.test(gst) || !pin || !/^\d{6}$/.test(pin) || isInternalAccount(c)) return null;
  return `${gst}|${pin}`;
}

/** customer -> every account of that dealer (sorted, includes itself). Only customers with 2+ accounts are listed. */
export function linkAccounts(customers: CustomerFacts[]): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const c of customers) {
    const k = dealerLinkKey(c);
    if (k) (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(c.customer);
  }
  const out = new Map<string, string[]>();
  for (const codes of byKey.values()) {
    if (codes.length < 2) continue;
    codes.sort();
    for (const c of codes) out.set(c, codes);
  }
  return out;
}

export async function linkedAccounts(): Promise<Map<string, string[]>> {
  const t = tables();
  const rows = await getDb()
    .select({ customer: t.sapCustomer.customer, name: t.sapCustomer.name, gstin: t.sapCustomer.gstin, postalCode: t.sapCustomer.postalCode })
    .from(t.sapCustomer);
  return linkAccounts(rows);
}
