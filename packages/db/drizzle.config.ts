import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
  // 0001_postgis_and_rls.sql is hand-written; keep drizzle-kit from clobbering it.
  migrations: {
    prefix: "index",
  },
  strict: true,
  verbose: true,
});
