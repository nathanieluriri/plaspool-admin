import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite, types } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../../server/db/schema';
import { guardDb } from '../../server/db/client';
import type { Db } from '../../server/db/client';
import { migrateWithReplayCheck } from '../../server/db/replay';
import { DEMO_DIR } from './env';

export interface DemoDb {
  db: Db;
  client: PGlite;
  fresh: boolean;
}

export async function openDemoDb(): Promise<DemoDb> {
  const dataDir = resolve(DEMO_DIR, 'pg');
  const fresh = !existsSync(dataDir);
  mkdirSync(DEMO_DIR, { recursive: true });
  // int8 as a string, the way Neon returns it, as server/test/harness.ts does.
  const client = new PGlite(dataDir, { parsers: { [types.INT8]: (value: string) => value } });
  const db = guardDb(drizzle(client, { schema }) as unknown as Db);
  await migrateWithReplayCheck(db, 'server/db/migrations', migrate);
  return { db, client, fresh };
}
