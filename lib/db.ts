import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Postgres, and the one rule that shapes this whole file: **the site must build
 * and boot without a database.**
 *
 * Railway builds the image before the Postgres service is attached, and a first
 * deploy may go up before anyone clicks "Add Postgres". If a missing
 * `DATABASE_URL` threw here, the build would fail and nobody would ever see the
 * page telling them what to configure. So reads degrade to empty and writes
 * refuse with a message a human can act on — the same posture `lib/razed.ts`
 * takes with a missing key.
 *
 * Nothing here is a stand-in for the real thing. Coins live in `coin_ledger`,
 * which is append-only, and every balance is derived and cached inside the same
 * transaction that writes the row. Losing that table means every balance on the
 * site is a guess (Master Plan §13), which is why nothing else is allowed to
 * write a balance.
 */

const globalStore = globalThis as unknown as {
  __msPool?: Pool | null;
  __msMigrated?: Promise<void>;
};

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

export function hasDatabase(): boolean {
  return Boolean(databaseUrl());
}

/**
 * Railway's internal Postgres URL needs no TLS; anything reached over the
 * public internet does, and its certificate is not one we can chain-verify from
 * inside the container. `rejectUnauthorized: false` is the documented setting
 * for managed Postgres and is what every provider's own connection snippet
 * uses — the traffic is still encrypted.
 */
function sslFor(url: string) {
  if (url.includes('sslmode=disable')) return false;
  const internal = /@[^/]*\.railway\.internal/.test(url) || /@(localhost|127\.0\.0\.1)/.test(url);
  return internal ? false : { rejectUnauthorized: false };
}

export function pool(): Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!globalStore.__msPool) {
    globalStore.__msPool = new Pool({
      connectionString: url,
      ssl: sslFor(url),
      // A Next.js server opens a pool per instance; keep it small so several
      // instances cannot exhaust Postgres between them.
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // A pool that throws on an idle client error takes the whole process with
    // it. Log and let the pool replace the client.
    globalStore.__msPool.on('error', (error) => {
      console.error('[db] idle client error', error.message);
    });
  }
  return globalStore.__msPool;
}

export class NoDatabaseError extends Error {
  constructor() {
    super('No database is configured. Set DATABASE_URL to enable this.');
    this.name = 'NoDatabaseError';
  }
}

/* -------------------------------------------------------------------------- */
/* Migrations                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Migrations run on first use rather than as a release command, so a fresh
 * Railway deploy is correct without anyone remembering a step. They are
 * numbered, applied once, and recorded — running twice is a no-op.
 *
 * The advisory lock matters: Railway can start two instances at once, and two
 * processes running `001_init.sql` simultaneously is how you get half a schema.
 */
async function runMigrations(p: Pool): Promise<void> {
  const dir = join(process.cwd(), 'db', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const client = await p.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [727_000_001]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[db] applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [727_000_001]).catch(() => {});
    client.release();
  }
}

/** Idempotent and memoised: the first caller migrates, everyone else waits. */
export async function ready(): Promise<Pool | null> {
  const p = pool();
  if (!p) return null;
  if (!globalStore.__msMigrated) {
    globalStore.__msMigrated = runMigrations(p).catch((error) => {
      // Clear the memo so the next request retries rather than the process
      // staying permanently broken after one transient failure.
      globalStore.__msMigrated = undefined;
      throw error;
    });
  }
  await globalStore.__msMigrated;
  return p;
}

/* -------------------------------------------------------------------------- */
/* Query helpers                                                              */
/* -------------------------------------------------------------------------- */

/** A read. Returns [] when there is no database rather than throwing. */
export async function rows<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const p = await ready();
  if (!p) return [];
  const result = await p.query<T>(text, values);
  return result.rows;
}

export async function one<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T | null> {
  const all = await rows<T>(text, values);
  return all[0] ?? null;
}

/** A write. Refuses loudly with no database — silence would lose data. */
export async function write<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const p = await ready();
  if (!p) throw new NoDatabaseError();
  const result = await p.query<T>(text, values);
  return result.rows;
}

/**
 * One transaction, committed or rolled back as a whole. Every coin movement
 * goes through this: debit, resolve, credit and ledger row are one write or
 * they are none.
 */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = await ready();
  if (!p) throw new NoDatabaseError();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** For the admin health card: is the database actually reachable? */
export async function databaseHealth(): Promise<
  { ok: true; latencyMs: number } | { ok: false; detail: string }
> {
  if (!hasDatabase()) return { ok: false, detail: 'DATABASE_URL is not set.' };
  const started = Date.now();
  try {
    await rows('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'Connection failed.' };
  }
}
