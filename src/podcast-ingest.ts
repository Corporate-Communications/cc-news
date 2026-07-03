/**
 * Bakoverkompatibel wrapper — bruk `npm run ingest aftenposten-podcast` i stedet.
 * Videresender alle argumenter til ingest.
 */
import { spawnSync } from "node:child_process";

const extra = process.argv.slice(2);
const args = ["src/ingest.ts", "aftenposten-podcast", ...extra];
const res = spawnSync("tsx", args, { stdio: "inherit", shell: false });
process.exit(res.status ?? 1);
