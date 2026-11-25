import { describe, expect, it } from "vitest";

process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";

describe("sign-in", () => {
  it("a session token round-trips, and expires", async () => {
    const { createSessionToken, readSessionToken, SESSION_DAYS } = await import("@/auth/session");
    const now = Date.parse("2026-11-25T10:00:00Z");
    const tok = createSessionToken("Samrat.Dutta@nitco.example", now);
    expect(readSessionToken(tok, now + 1000)).toBe("samrat.dutta@nitco.example");
    expect(readSessionToken(tok, now + (SESSION_DAYS + 1) * 86_400_000)).toBeNull();
  });
  it("a tampered or foreign token is rejected", async () => {
    const { createSessionToken, readSessionToken } = await import("@/auth/session");
    const tok = createSessionToken("rmi@nitco.example");
    const [payload, mac] = tok.split(".");
    const forged = Buffer.from(JSON.stringify({ e: "admin@nitco.example", x: Date.now() + 1e9 })).toString("base64url");
    expect(readSessionToken(`${forged}.${mac}`)).toBeNull();
    expect(readSessionToken(`${payload}.x${mac.slice(1)}`)).toBeNull();
    expect(readSessionToken("garbage")).toBeNull();
    expect(readSessionToken(undefined)).toBeNull();
  });
  it("passwords are hashed and verified", async () => {
    const { hashPassword, verifyPassword, generatePassword } = await import("@/auth/session");
    const p = generatePassword();
    expect(p).toMatch(/^[\w]{4}-[\w]{4}-[\w]{4}-[\w]{4}$/);
    const h = hashPassword(p);
    expect(h).not.toContain(p);
    expect(verifyPassword(p, h)).toBe(true);
    expect(verifyPassword(p + "x", h)).toBe(false);
  });
  it("scoped users only ever see their scope", async () => {
    const { scopeFilter } = await import("@/auth/viewer");
    expect(scopeFilter({ id: "a", name: "A", role: "rmi", rmiName: "Samrat Dutta" }, { zones: ["West Zone 1"] })).toEqual({ zones: ["West Zone 1"], rmiNames: ["Samrat Dutta"] });
    expect(scopeFilter({ id: "z", name: "Z", role: "zonal", zone: "East Zone 1" }, { zones: ["West Zone 1"] })).toEqual({ zones: ["East Zone 1"] });
    expect(scopeFilter({ id: "x", name: "X", role: "zonal" }, {}).zones).toEqual(["\u0000none"]);
    expect(scopeFilter({ id: "ad", name: "Ad", role: "admin" }, { zones: ["West Zone 1"] })).toEqual({ zones: ["West Zone 1"] });
  });
});
