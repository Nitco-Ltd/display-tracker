// Generates SQL migrations for each dialect (developer use only):
//   npm run db:generate   -> drizzle/sqlite and drizzle/pg
// At runtime, every script applies pending migrations automatically (src/db/migrate.ts).
import { defineConfig } from "drizzle-kit";

const isPg = process.env.DRIZZLE_DIALECT === "pg";

export default defineConfig(
  isPg
    ? { dialect: "postgresql", schema: "./src/db/schema.pg.ts", out: "./drizzle/pg" }
    : { dialect: "sqlite", schema: "./src/db/schema.sqlite.ts", out: "./drizzle/sqlite" },
);
