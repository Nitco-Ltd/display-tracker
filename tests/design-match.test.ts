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
