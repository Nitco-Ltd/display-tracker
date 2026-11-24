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
