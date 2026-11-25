// npm run users -- <command>       Manage who can sign in to the dashboard (run on the sync PC; the next
//                                   publish copies the list to the cloud, or run `npm run publish` straight away).
//
//   list
//   add    <email> "<Name>" admin
//   add    <email> "<Name>" zonal "<Zone as in RMI>"        e.g. "East Zone 1"
//   add    <email> "<Name>" rmi   "<RMI name as in RMI>"    e.g. "Samrat Dutta"
//   import <file.csv>        columns: email,name,role,scope   (scope = zone or RMI name; blank for admin)
//   reset  <email>           new password
//   disable <email> | enable <email>
//
// New passwords are printed once. Give each person their own; they are stored only as hashes.
import "./env";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { closeDb, getDb, tables } from "@/db/client";
import { ensureSchema } from "@/db/migrate";
import { generatePassword, hashPassword } from "@/auth/session";

const ROLES = ["admin", "zonal", "rmi"] as const;
type Role = (typeof ROLES)[number];

async function known(): Promise<{ zones: Set<string>; rmis: Set<string> }> {
  const t = tables();
  const rows = await getDb().select({ zone: t.rmiDisplay.zone, rmi: t.rmiDisplay.rmiName }).from(t.rmiDisplay);
  return { zones: new Set(rows.map((r) => r.zone ?? "")), rmis: new Set(rows.map((r) => r.rmi ?? "")) };
}

async function addUser(email: string, name: string, role: string, scope: string | undefined, k: Awaited<ReturnType<typeof known>>) {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Not an email: ${email}`);
  if (!ROLES.includes(role as Role)) throw new Error(`Role must be admin, zonal or rmi (got "${role}")`);
  if (role === "zonal" && !k.zones.has(scope ?? "")) throw new Error(`Zone "${scope}" not found in RMI data. Known: ${[...k.zones].filter(Boolean).sort().join(", ")}`);
  if (role === "rmi" && !k.rmis.has(scope ?? "")) throw new Error(`RMI name "${scope}" not found in RMI data (spelling must match RMI exactly)`);
  const password = generatePassword();
  const now = new Date().toISOString();
  const t = tables();
  const row = {
    email,
    name: name.trim(),
    role,
    zone: role === "zonal" ? scope! : null,
    rmiName: role === "rmi" ? scope! : null,
    passwordHash: hashPassword(password),
    active: 1,
    createdAt: now,
    updatedAt: now,
  };
  await getDb()
    .insert(t.appUser)
    .values(row)
    .onConflictDoUpdate({ target: t.appUser.email, set: { name: row.name, role, zone: row.zone, rmiName: row.rmiName, passwordHash: row.passwordHash, active: 1, updatedAt: now } });
  console.log(`${email}\t${role}${scope ? ` (${scope})` : ""}\tpassword: ${password}`);
}

async function main() {
  await ensureSchema();
  const [cmd, ...a] = process.argv.slice(2);
  const t = tables();
  const db = getDb();
  if (cmd === "list" || !cmd) {
    for (const u of await db.select().from(t.appUser))
      console.log(`${u.active ? "  " : "x "}${u.email}\t${u.name}\t${u.role}${u.zone ? ` (${u.zone})` : ""}${u.rmiName ? ` (${u.rmiName})` : ""}`);
    return;
  }
  if (cmd === "add") return addUser(a[0], a[1], a[2], a[3], await known());
  if (cmd === "import") {
    const k = await known();
    const lines = readFileSync(a[0], "utf8").split(/\r?\n/).filter((l) => l.trim());
    for (const line of lines.slice(/^email,/i.test(lines[0]) ? 1 : 0)) {
      const [email, name, role, scope] = line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
      try {
        await addUser(email, name, role, scope || undefined, k);
      } catch (e) {
        console.error(`SKIPPED ${email}: ${(e as Error).message}`);
      }
    }
    return;
  }
  if (cmd === "reset") {
    const password = generatePassword();
    const r = await db.update(t.appUser).set({ passwordHash: hashPassword(password), updatedAt: new Date().toISOString() }).where(eq(t.appUser.email, a[0].toLowerCase())).returning({ e: t.appUser.email });
    console.log(r.length ? `${a[0]}\tnew password: ${password}` : `No user ${a[0]}`);
    return;
  }
  if (cmd === "disable" || cmd === "enable") {
    const r = await db.update(t.appUser).set({ active: cmd === "enable" ? 1 : 0, updatedAt: new Date().toISOString() }).where(eq(t.appUser.email, a[0].toLowerCase())).returning({ e: t.appUser.email });
    console.log(r.length ? `${a[0]} ${cmd}d` : `No user ${a[0]}`);
    return;
  }
  throw new Error(`Unknown command "${cmd}". See the top of scripts/users.ts.`);
}

main()
  .catch((e) => {
    console.error("FAILED:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(closeDb);
