import { describe, expect, it } from "vitest";
import { CUSTOMER_GROUP_NAMES, isRetailGroup } from "@/sales/customers";

describe("customer type (SAP Customer Group 2)", () => {
  it("Retail only leaves out Key Accounts (09) and Retail Project accounts (12)", () => {
    expect(isRetailGroup("09")).toBe(false);
    expect(isRetailGroup("12")).toBe(false);
  });
  it("keeps every other group, and customers without a group", () => {
    for (const g of ["10", "02", "03", "04", "05", "07", "08"]) expect(isRetailGroup(g)).toBe(true);
    expect(isRetailGroup(null)).toBe(true);
  });
  it("names the groups as SAP's text does", () => {
    expect(CUSTOMER_GROUP_NAMES["09"]).toBe("Key Account");
    expect(CUSTOMER_GROUP_NAMES["12"]).toBe("Retail Project");
  });
});
