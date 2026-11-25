import { describe, expect, it } from "vitest";
import { dealerLinkKey, linkAccounts } from "@/sales/dealers";

const shreeShyam = { customer: "0011002222", name: "SHREE SHYAM TILES", gstin: "10COSPP0792L1ZG", postalCode: "846004" };
const shreeShyamProject = { customer: "0011007639", name: "Shree Shyam Tiles", gstin: "10cospp0792l1zg", postalCode: "846004" };

describe("linked dealer accounts", () => {
  it("same GST number and PIN code are one dealer", () => {
    const m = linkAccounts([shreeShyam, shreeShyamProject, { customer: "0011000001", name: "Other", gstin: "10ABCDE1234F1Z5", postalCode: "846004" }]);
    expect(m.get("0011002222")).toEqual(["0011002222", "0011007639"]);
    expect(m.get("0011007639")).toEqual(["0011002222", "0011007639"]);
    expect(m.has("0011000001")).toBe(false); // no second account
  });
  it("same GST number in another PIN code is not linked", () => {
    expect(linkAccounts([shreeShyam, { ...shreeShyamProject, postalCode: "800001" }]).size).toBe(0);
  });
  it("NITCO's own accounts are never linked", () => {
    const nitco = { customer: "0000001840", name: "Nitco Limited - Banglore", gstin: "29AAACN1234F1Z5", postalCode: "560001" };
    const studio = { customer: "0011004854", name: "Le Studio - Bangalore", gstin: "29AAACN1234F1Z5", postalCode: "560001" };
    const nitco2 = { customer: "0011004952", name: "NITCO LIMITED (KARNATAKA)", gstin: "29AAACN1234F1Z5", postalCode: "560001" };
    expect(linkAccounts([nitco, studio, nitco2]).size).toBe(0);
  });
  it("blank or malformed GST numbers are not linked", () => {
    expect(dealerLinkKey({ ...shreeShyam, gstin: null })).toBeNull();
    expect(dealerLinkKey({ ...shreeShyam, gstin: "URP" })).toBeNull();
    expect(dealerLinkKey({ ...shreeShyam, postalCode: null })).toBeNull();
  });
});
