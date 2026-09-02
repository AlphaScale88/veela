/**
 * Apply one hand-written migration from `packages/db/migrations/`.
 *
 *     node scripts/apply-migration.mjs 0011
 *     node scripts/apply-migration.mjs 0011 --dry-run
 *
 * This repository has always had hand-written migrations and **no runner**, so they were
 * applied by pasting statements one at a time — which is how a `kind`/`rvd_class` column
 * mix-up and a wrong-cased variable both reached a live database before being caught. A file
 * that has been read and committed is a reviewable unit; a statement typed at a prompt is not.
 *
 * `drizzle-kit migrate` is not the tool here: this repo keeps no migration journal (see
 * CLAUDE.md on why `generate` would try to recreate every table), so there is nothing for it
 * to diff against.
 *
 * **No journal table is written.** Adding one would itself be a schema change, and with eleven
 * migrations applied by hand there is no honest history to backfill it with. Statements are
 * therefore reported individually and a re-run is expected to report the already-applied ones
 * as failures — read the output rather than trusting an exit code.
 */

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, "packages", "db", "migrations");

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

const prefix = process.argv[2];
const DRY = process.argv.includes("--dry-run");
if (prefix === undefined) {
  console.error("usage: node scripts/apply-migration.mjs <prefix> [--dry-run]");
  process.exit(1);
}

const match = readdirSync(DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".sql"));
if (match.length !== 1) {
  console.error(`expected exactly one migration starting "${prefix}", found ${match.length}`);
  process.exit(1);
}

const file = match[0];
const sqlText = readFileSync(join(DIR, file), "utf8");

/*
 * Strip `--` line comments before splitting on semicolons. These migrations carry long
 * explanatory comments — 0011's are most of the file — and a comment containing a semicolon
 * would otherwise cut a statement in half. No migration here puts a semicolon inside a string
 * literal; if one ever does, this needs a real parser rather than a regex.
 */
const statements = sqlText
  .split("\n")
  .map((l) => (l.trimStart().startsWith("--") ? "" : l))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`${file} — ${statements.length} statement(s)${DRY ? "  [dry run]" : ""}\n`);

if (DRY) {
  statements.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${s.replace(/\s+/g, " ")}\n`));
  process.exit(0);
}

const url = loadDatabaseUrl();
if (url === undefined) {
  console.error("No DATABASE_URL in the environment, apps/web/.env.local or .env.local.");
  process.exit(1);
}

const require = createRequire(join(ROOT, "packages", "db", "package.json"));
const postgres = (await import(pathToFileURL(require.resolve("postgres")).href)).default;
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

let failed = 0;
try {
  for (const [i, statement] of statements.entries()) {
    const oneLine = statement.replace(/\s+/g, " ");
    const shown = oneLine.length > 110 ? `${oneLine.slice(0, 107)}...` : oneLine;
    process.stdout.write(`${String(i + 1).padStart(2)}. ${shown}\n`);
    try {
      const rows = await sql.unsafe(statement);
      const n = Array.isArray(rows) ? rows.count : undefined;
      console.log(`    ok${n !== undefined ? ` — ${n} row(s)` : ""}`);
    } catch (err) {
      failed += 1;
      console.log(`    FAILED — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
} finally {
  await sql.end();
}

console.log(`\n${statements.length - failed}/${statements.length} applied.`);
if (failed > 0) process.exitCode = 1;
