import { describe, expect, it } from "vitest";
import {
  designKey,
  normalizeCassetteType,
  normalizeDealerName,
  normalizeDisplayedWhere,
  normalizePanelSize,
  normalizeProductType,
  normalizeTileSize,
  parseRmiDate,
} from "@/lib/normalize";

describe("normalizers", () => {
  it("parses RMI dates", () => {
    expect(parseRmiDate("04 Aug 2026")).toBe("2026-08-04");
    expect(parseRmiDate("5 Feb 2029")).toBe("2029-02-05");
    expect(parseRmiDate("")).toBeNull();
    expect(parseRmiDate("2026-08-04")).toBeNull();
  });

  it("normalizes panel sizes from the sample's free text", () => {
    for (const v of ["8X4", "8x4", "8  X  4", "8 H x 4 W", "4x8"]) expect(normalizePanelSize(v)).toBe("8x4 ft");
    for (const v of ["1200X2400", "1200x2400", "1200 x 2400 mm"]) expect(normalizePanelSize(v)).toBe("2400x1200 mm");
    expect(normalizePanelSize("4 W x 4 H")).toBe("4x4 ft");
    expect(normalizePanelSize("2.5x8")).toBe("8x2.5 ft");
    for (const v of ["0", "3", "", null]) expect(normalizePanelSize(v)).toBeNull();
  });

  it("normalizes dealer names to 'code - name'", () => {
    expect(normalizeDealerName("0011000111", "0011000111 - Concrete Concept")).toBe("0011000111 - Concrete Concept");
    expect(normalizeDealerName("0011000111", "Concrete Concept")).toBe("0011000111 - Concrete Concept");
    expect(normalizeDealerName("0011000111", null)).toBe("0011000111");
  });

  it("maps known typos via the lookup tables", () => {
    expect(normalizeCassetteType("Horizotal 45 Degree")).toBe("Horizontal 45 Degree");
    expect(normalizeDisplayedWhere("Cassettee")).toBe("Cassette");
    expect(normalizeProductType("Ceramic wall")).toBe("Ceramic Wall");
    expect(normalizeProductType("Full body vitrified")).toBe("Full Body Vitrified");
    expect(normalizeProductType("Something New")).toBe("Something New"); // unknown values pass through
  });

  it("normalizes tile sizes and design keys", () => {
    expect(normalizeTileSize("600X1200")).toBe("600x1200");
    expect(normalizeTileSize("1200x600")).toBe("600x1200");
    expect(designKey("Encore Creme (Finitura)")).toBe("encore creme finitura");
    expect(designKey("Aeon Armani - G")).toBe("aeon armani g");
  });
});
