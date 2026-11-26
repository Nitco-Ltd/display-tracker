import { describe, expect, it } from "vitest";
import { CUSTOMER_GROUP_NAMES, isRetail, isRetailGroup } from "@/sales/customers";

describe("customer type (SAP Customer Group 2)", () => {
  it("Retail leaves out Key Accounts (09) only", () => {
    expect(isRetailGroup("09")).toBe(false);
  });
  it("keeps every other group, including Retail Project (12), and customers without a group", () => {
    for (const g of ["10", "12", "02", "03", "04", "05", "07", "08"]) expect(isRetailGroup(g)).toBe(true);
    expect(isRetailGroup(null)).toBe(true);
  });
  it("export customers (sales org 1802) are not retail, whatever their group", () => {
    expect(isRetail({ group: "10", market: "export" })).toBe(false);
    expect(isRetail({ group: "10", market: "domestic" })).toBe(true);
    expect(isRetail({ group: "09", market: "domestic" })).toBe(false);
  });
  it("names the groups as SAP's text does", () => {
    expect(CUSTOMER_GROUP_NAMES["09"]).toBe("Key Account");
    expect(CUSTOMER_GROUP_NAMES["12"]).toBe("Retail Project");
  });
});
