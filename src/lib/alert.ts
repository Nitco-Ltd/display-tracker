// Optional email alert when the scheduled job fails. Off unless SMTP_HOST and ALERT_EMAIL_TO are set.
// The dashboard's red "Sync failed" banner works regardless.
import nodemailer from "nodemailer";
import { config, csv } from "./config";
import { log, redact } from "./log";

export function buildAlert(error: string, when = new Date()) {
  const stamp = when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return {
    subject: `Display Tracker: daily sync failed (${stamp})`,
    text: [
      `The scheduled Display Tracker sync failed at ${stamp}.`,
      "",
      redact(error),
      "",
      "The dashboard keeps showing the last good data, with a red banner, until the next successful run.",
      "See README.md > Troubleshooting, and the log file in the logs folder.",
    ].join("\n"),
  };
}

export async function sendAlert(error: string): Promise<boolean> {
  const c = config();
  const to = csv(c.ALERT_EMAIL_TO ?? "");
  if (!c.SMTP_HOST || !to.length) return false;
  try {
    const transport = nodemailer.createTransport({
      host: c.SMTP_HOST,
      port: c.SMTP_PORT,
      secure: c.SMTP_PORT === 465,
      auth: c.SMTP_USER ? { user: c.SMTP_USER, pass: c.SMTP_PASS } : undefined,
    });
    const msg = buildAlert(error);
    await transport.sendMail({ from: c.SMTP_FROM ?? c.SMTP_USER, to, ...msg });
    log.info(`alert email sent to ${to.join(", ")}`);
    return true;
  } catch (e) {
    log.error(`could not send alert email: ${(e as Error).message}`);
    return false;
  }
}
