/**
 * Ad-hoc read-only query against the project database.
 *
 *     node scripts/db-query.mjs "select count(*) from market_observations"
 *
 * Exists because inspecting what is actually stored, rather than what the ingest script
 * believes it stored, is the step that has caught every column mistake in this repo so far.
 * Reads `DATABASE_URL` the same way `ingest-official.mjs` does -- from the environment, then
 * `apps/web/.env.local`, then the repository root -- because the connection string does not
 * live where a first guess puts it.
 *
 * `postgres` is a dependency of `packages/db`, so a bare import does not resolve from here:
 * pnpm keeps each package's `node_modules` to itself. Resolved against that package instead.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const rel of ["apps/web/.env.local", ".env.local"]) {
    try {
      const body = readFileSync(join(ROOT, rel), "utf8");
      const line = body.split("\n").find((l) => l.startsWith("DATABASE_URL="));
      if (line === undefined) continue;
      return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    } catch {
      /* not there — try the next */
    }
  }
  return undefined;
}

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error("usage: node scripts/db-query.mjs \"<sql>\"");
  process.exit(1);
}

const url = loadDatabaseUrl();
if (url === undefined) {
  console.error("No DATABASE_URL in the environment, apps/web/.env.local or .env.local.");
  process.exit(1);
}

const require = createRequire(join(ROOT, "packages", "db", "package.json"));
const postgres = (await import(pathToFileURL(require.resolve("postgres")).href)).default;
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  const rows = await sql.unsafe(query);
  console.log(JSON.stringify(rows, null, 2));
} catch (err) {
  console.error("FAILED —", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await sql.end();
}
