import { describe, expect, it } from "vitest";
import { paramList, toQuery } from "@/lib/params";

describe("URL filters", () => {
  it("reads a parameter as a list", () => {
    expect(paramList(undefined)).toEqual([]);
    expect(paramList("East Zone 1")).toEqual(["East Zone 1"]);
    expect(paramList(["a", "", "b"])).toEqual(["a", "b"]);
  });
  it("rebuilds the query without some keys and with overrides", () => {
    expect(toQuery({ zone: ["Z1", "Z2"], page: "3", month: "2026-08" }, { omit: ["page"], set: { month: "2026-09" } })).toBe("zone=Z1&zone=Z2&month=2026-09");
  });
});
