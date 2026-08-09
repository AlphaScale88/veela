import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

export type Database = ReturnType<typeof createClient>;

/**
 * Two connection modes, and the difference matters for security.
 *
 * - `anon`: a per-request client carrying the user's JWT, so **RLS applies**. This
 *   is what request handlers use. Authorisation is enforced by Postgres, not by
 *   remembering to add a `where owner_id = ...` clause.
 * - `service`: bypasses RLS. Only for ingestion jobs that load public reference
 *   data. Never reachable from a request path.
 */
export function createClient(connectionString: string, opts?: { max?: number }) {
  const sql = postgres(connectionString, {
    max: opts?.max ?? 10,
    prepare: false, // required when going through Supabase's pooler
  });
  return drizzle(sql, { schema });
}

/**
 * Bind a connection to the caller's identity so RLS policies see `auth.uid()`.
 * Supabase reads it from the `request.jwt.claims` GUC.
 */
export async function withUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      `select set_config('request.jwt.claims', '{"sub":"${userId}"}', true)`,
    );
    return fn(tx as unknown as Database);
  });
}
