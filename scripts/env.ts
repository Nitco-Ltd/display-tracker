// Loads .env for CLI scripts (Next.js loads it on its own for the dashboard).
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
