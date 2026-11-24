// npm run sap:cert            show the certificate SAP presents now, and whether it matches the saved one
// npm run sap:cert -- --save  save it to SAP_TLS_CA_FILE (only after IT confirms the fingerprint)
//
// Reads the certificate only. No login, no data. Used when SAP's certificate is renewed (current one expires 2038).
import "./env";
import { createHash, X509Certificate } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:tls";
import { config } from "@/lib/config";

const c = config();
if (!c.SAP_ODATA_BASE_URL) throw new Error("SAP_ODATA_BASE_URL is blank in .env");
const url = new URL(c.SAP_ODATA_BASE_URL);
const file = c.SAP_TLS_CA_FILE ?? "./certs/sap-prd.pem";

// rejectUnauthorized:false is ONLY to read the certificate for display; nothing else is sent on this connection.
const sock = connect({ host: url.hostname, port: Number(url.port || 443), servername: c.SAP_TLS_SERVERNAME, rejectUnauthorized: false }, () => {
  const raw = sock.getPeerCertificate(true).raw;
  sock.end();
  const pem = `-----BEGIN CERTIFICATE-----\n${raw.toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----\n`;
  const cert = new X509Certificate(pem);
  const fp = (p: string) => createHash("sha256").update(new X509Certificate(p).raw).digest("hex").toUpperCase().match(/../g)!.join(":");
  console.log(`Server:      ${url.host}`);
  console.log(`Subject:     ${cert.subject.replace(/\n/g, ", ")}`);
  console.log(`Valid until: ${cert.validTo}`);
  console.log(`SHA-256:     ${fp(pem)}`);
  if (existsSync(file)) console.log(fp(readFileSync(file, "utf8")) === fp(pem) ? `Matches the saved certificate (${file}).` : `DIFFERENT from the saved certificate (${file}).`);
  if (process.argv.includes("--save")) {
    writeFileSync(file, pem);
    console.log(`Saved to ${file}.`);
  } else console.log("Check the SHA-256 fingerprint with IT, then run again with --save to trust it.");
});
sock.on("error", (e) => {
  console.error(`Could not connect to ${url.host}: ${e.message}`);
  process.exitCode = 1;
});
