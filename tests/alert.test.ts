import { describe, expect, it } from "vitest";
import { buildAlert, sendAlert } from "@/lib/alert";

describe("failure alert", () => {
  it("is off when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    expect(await sendAlert("RMI: boom")).toBe(false);
  });

  it("never includes secrets in the email", () => {
    process.env.SAP_PASS = "SuperSecret99";
    const m = buildAlert("SAP probe: HTTP 401 authorization: Bearer abc.def.ghi password=SuperSecret99");
    expect(m.subject).toMatch(/daily sync failed/);
    expect(m.text).not.toContain("SuperSecret99");
    expect(m.text).not.toContain("abc.def.ghi");
  });
});
