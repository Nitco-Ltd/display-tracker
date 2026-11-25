import { describe, expect, it } from "vitest";
import { matchDesign, similarity, sizeFromCode, type Candidate } from "@/sync/design-match";
import { designKey } from "@/lib/normalize";

const catalog: Candidate[] = [
  { code: "TIGVMPL1200X600NOGL02140", name: "Aeon Armani - G", sizeKey: "600x1200", source: "rmi" },
  { code: "TICESRT300X300GLMA12001", name: "Rio Bianco Beige", sizeKey: "300x300", source: "rmi" },
  { code: "TICESRT600X600GLMA04002", name: "Rio Bianco Beige", sizeKey: "600x600", source: "rmi" },
  { code: "TIWAHLL600X300PUGL05060", name: "Silk Peach Onyx", sizeKey: "300x600", source: "rmi" },
];
const byName = new Map<string, Candidate[]>();
for (const c of catalog) byName.set(designKey(c.name), [...(byName.get(designKey(c.name)) ?? []), c]);

describe("design → material matching", () => {
  it("reads the size out of a material code", () => {
    expect(sizeFromCode("TIGVMPL1200X600NOGL02140")).toBe("600x1200");
  });

  it("exact unique name is used automatically", () => {
    const m = matchDesign("aeon armani g", "600x1200", catalog, byName);
    expect(m).toMatchObject({ method: "exact_name", status: "auto", materialCode: "TIGVMPL1200X600NOGL02140" });
  });

  it("same name, several codes, size decides", () => {
    const m = matchDesign("rio bianco beige", "600x600", catalog, byName);
    expect(m).toMatchObject({ method: "name_and_size", status: "auto", materialCode: "TICESRT600X600GLMA04002" });
  });

  it("same name, size doesn't decide -> needs review, not used", () => {
    const m = matchDesign("rio bianco beige", "300x600", catalog, byName);
    expect(m.status).toBe("needs_review");
    expect(m.method).toBe("ambiguous");
    expect(m.candidates).toHaveLength(2);
  });

  it("similar name (e.g. ' - N' suffix) is proposed for review, never auto", () => {
    const m = matchDesign(designKey("Silk Peach Onyx - N"), "300x600", catalog, byName);
    expect(m).toMatchObject({ method: "fuzzy", status: "needs_review", materialCode: "TIWAHLL600X300PUGL05060" });
  });

  it("nothing similar -> unmapped", () => {
    expect(matchDesign("cuisine", "", catalog, byName).status).toBe("unmapped");
    expect(similarity("abc", "abc")).toBe(1);
  });
});

describe("SAP description tier", () => {
  const sap: Candidate[] = [
    { code: "TIGVXXX600X600AA00001", name: "Tropicana Rose", sizeKey: "600x600", source: "sap" },
    { code: "TIGVXXX600X600AA00002", name: "Tropicana Rose", sizeKey: "300x600", source: "sap" },
    { code: "TIGVXXX600X600AA00003", name: "Twin Name", sizeKey: "600x600", source: "sap" },
    { code: "TIGVYYY600X600AA00004", name: "Twin Name", sizeKey: "600x600", source: "sap" },
  ];
  const sapByName = new Map<string, Candidate[]>();
  for (const c of sap) sapByName.set(designKey(c.name), [...(sapByName.get(designKey(c.name)) ?? []), c]);

  it("uses SAP only when RMI's catalogue has no match, and only with name + size", () => {
    expect(matchDesign("tropicana rose", "600x600", catalog, byName, sapByName)).toMatchObject({
      method: "sap_name_and_size",
      status: "auto",
      materialCode: "TIGVXXX600X600AA00001",
    });
  });
  it("RMI's catalogue wins over SAP", () => {
    expect(matchDesign("aeon armani g", "600x1200", catalog, byName, sapByName).method).toBe("exact_name");
  });
  it("unique name but different size -> needs review (or the right size from SAP)", () => {
    const m = matchDesign("aeon armani g", "600x600", catalog, byName, sapByName);
    expect(m).toMatchObject({ method: "size_mismatch", status: "needs_review" });
    const sap2 = new Map(sapByName);
    sap2.set("aeon armani g", [{ code: "TIGVAAA600X600GL0001", name: "Aeon Armani - G", sizeKey: "600x600", source: "sap" }]);
    expect(matchDesign("aeon armani g", "600x600", catalog, byName, sap2)).toMatchObject({ method: "sap_name_and_size", materialCode: "TIGVAAA600X600GL0001" });
  });
  it("a display using RMI's own (wrong) size label for the product is not a size conflict", () => {
    const plank: Candidate = { code: "TIGVWPP1200X200NOMA04004", name: "Red Oak", sizeKey: "200x1200", labelSizeKey: "200x1000", source: "rmi" };
    const by = new Map([["red oak", [plank]]]);
    expect(matchDesign("red oak", "200x1200", [plank], by, new Map()).status).toBe("auto"); // real size
    expect(matchDesign("red oak", "200x1000", [plank], by, new Map()).status).toBe("auto"); // RMI's label
    expect(matchDesign("red oak", "600x600", [plank], by, new Map()).method).toBe("size_mismatch");
  });
  it("two SAP codes with the same name and size (not packaging twins) -> needs review", () => {
    expect(matchDesign("twin name", "600x600", catalog, byName, sapByName)).toMatchObject({ method: "ambiguous", status: "needs_review" });
  });
});

describe("packaging variants in design matching", () => {
  it("several codes that are packaging twins are linked automatically", () => {
    const twins: Candidate[] = [
      { code: "TIGVIBR1200X600NOMA03031", name: "Paleo Slate", sizeKey: "600x1200", source: "rmi" },
      { code: "TIGVIBR1200X600NOMA02057", name: "Paleo Slate", sizeKey: "600x1200", source: "rmi" },
    ];
    const idx = new Map([[designKey("Paleo Slate"), twins]]);
    const m = matchDesign("paleo slate", "600x1200", twins, idx);
    expect(m.status).toBe("auto");
    expect(m.method).toBe("packaging_variants");
    expect(m.materialCode).toBe("TIGVIBR1200X600NOMA02057");
  });
  it("codes that differ in more than the serial still need review", () => {
    const c: Candidate[] = [
      { code: "TIDCDTL600X600NOGL04024", name: "Tropicana Sand", sizeKey: "600x600", source: "rmi" },
      { code: "TIDCDTM600X600NOGL04003", name: "Tropicana Sand", sizeKey: "600x600", source: "rmi" },
    ];
    const m = matchDesign("tropicana sand", "600x600", c, new Map([[designKey("Tropicana Sand"), c]]));
    expect(m.status).toBe("needs_review");
  });
});
