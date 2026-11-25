import { describe, expect, it } from "vitest";
import { addMonths, monthLabel, windowMonths } from "@/sales/window";

describe("report window", () => {
  it("runs from 1 month before to 12 after the cohort month", () => {
    const w = windowMonths("2026-08");
    expect(w).toHaveLength(14);
    expect(w[0]).toBe("2026-07");
    expect(w.at(-1)).toBe("2027-08");
    expect(w.map(monthLabel).slice(0, 2)).toEqual(["Jul-26", "Aug-26"]);
    expect(monthLabel("2027-08")).toBe("Aug-27");
    expect(monthLabel("2026-09")).toBe("Sep-26"); // not "Sept" (en-GB locale)
  });
  it("crosses year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

import { packagingFamilyKey } from "@/sales/window";

describe("packaging variants (same design, new code for new packaging)", () => {
  it("codes that differ only in the last 5 digits and share the design name are one family", () => {
    const a = packagingFamilyKey("TIGVMPL1200X600NOGL02160", "Oyster Blue Onyx");
    const b = packagingFamilyKey("TIGVMPL1200X600NOGL03021", "OYSTER BLUE ONYX");
    expect(a).toBe(b);
  });
  it("a different design name with the same prefix is a different family", () => {
    expect(packagingFamilyKey("TIGVMPL1200X600NOGL02160", "Oyster Blue Onyx")).not.toBe(
      packagingFamilyKey("TIGVMPL1200X600NOGL02161", "Oyster Grey Onyx"),
    );
  });
  it("codes that differ earlier in the code (DCH vs DTL) are not merged", () => {
    expect(packagingFamilyKey("TIDCDCH800X800MHGL03017", "Tropicana Gold")).not.toBe(
      packagingFamilyKey("TIDCDTL800X800MHGL03002", "Tropicana Gold"),
    );
  });
  it("a shorter serial number is the same family (Caspian Onyx …02003 / …0301)", () => {
    expect(packagingFamilyKey("TIGVBMM1200X600NOGL02003", "Caspian Onyx BM - A")).toBe(packagingFamilyKey("TIGVBMM1200X600NOGL0301", "Caspian Onyx BM - A"));
  });
  it("codes without a serial-number tail stand alone", () => {
    expect(packagingFamilyKey("ABC", "Oyster Blue Onyx")).toBe("ABC");
  });
});
