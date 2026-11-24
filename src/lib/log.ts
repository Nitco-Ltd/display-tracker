// Minimal logger. Redacts anything that looks like a credential before printing.
const SECRET_PATTERNS: RegExp[] = [
  /(bearer\s+)[A-Za-z0-9._~+\/=-]+/gi,
  /("?(?:password|pass|nrmitoken|authtoken|authorization)"?\s*[:=]\s*)"?[^",\s}]+"?/gi,
];

export function redact(s: string): string {
  let out = s;
  for (const p of SECRET_PATTERNS) out = out.replace(p, "$1<redacted>");
  for (const k of ["RMI_PASS", "RMI_APP_KEY", "SAP_PASS"]) {
    const v = process.env[k];
    if (v && v.length >= 4) out = out.split(v).join("<redacted>");
  }
  return out;
}

function stamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export const log = {
  info: (msg: string) => console.log(`${stamp()}  ${redact(msg)}`),
  warn: (msg: string) => console.warn(`${stamp()}  WARN  ${redact(msg)}`),
  error: (msg: string) => console.error(`${stamp()}  ERROR ${redact(msg)}`),
  debug: (msg: string) => {
    if (process.env.LOG_DEBUG === "1" || process.env.LOG_DEBUG === "true")
      console.log(`${stamp()}  debug ${redact(msg)}`);
  },
};
