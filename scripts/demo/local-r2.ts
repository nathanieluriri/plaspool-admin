import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Stands in for server/storage/r2.ts in the demo (swapped by resolve-r2.mjs),
// with the same exports, so image upload and serving run for real on local disk.

export const PRESIGN_TTL_SECONDS = 300;
export const OBJECT_ROUTE = '/api/__objects/';

export interface PresignedPut {
  url: string;
  headers: Record<string, string>;
  expiresIn: number;
}

export interface ObjectHead {
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
}

export class R2NotConfiguredError extends Error {
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(`R2 is not configured: ${missing.join(', ')}`);
    this.name = 'R2NotConfiguredError';
    this.missing = missing;
  }
}

const root = () => resolve(process.env.DEMO_OBJECTS_DIR ?? '.demo-db/objects');

function pathFor(key: string): string {
  const safe = key.split('/').filter((part) => part && part !== '..' && part !== '.');
  return join(root(), ...safe);
}

const metaFor = (key: string) => `${pathFor(key)}.type`;

export function resetR2ClientForTests(): void {}

export async function presignPut(
  key: string,
  contentType: string,
  byteSize: number,
): Promise<PresignedPut> {
  return {
    url: OBJECT_ROUTE + key,
    headers: { 'Content-Type': contentType, 'Content-Length': String(byteSize) },
    expiresIn: PRESIGN_TTL_SECONDS,
  };
}

export async function presignGet(key: string): Promise<string> {
  return OBJECT_ROUTE + key;
}

export async function headObject(key: string): Promise<ObjectHead | null> {
  try {
    const size = statSync(pathFor(key)).size;
    const bytes = readFileSync(pathFor(key));
    return {
      contentLength: size,
      contentType: readType(key),
      etag: `"${createHash('md5').update(bytes).digest('hex')}"`,
    };
  } catch {
    return null;
  }
}

export async function getRange(key: string, length: number): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(readFileSync(pathFor(key)).subarray(0, Math.max(0, length)));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  rmSync(pathFor(key), { force: true });
  rmSync(metaFor(key), { force: true });
}

export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  mkdirSync(dirname(pathFor(key)), { recursive: true });
  writeFileSync(pathFor(key), bytes);
  writeFileSync(metaFor(key), contentType);
}

export function readObject(key: string): { bytes: Buffer; contentType: string } | null {
  try {
    return {
      bytes: readFileSync(pathFor(key)),
      contentType: readType(key) ?? 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

function readType(key: string): string | null {
  try {
    return readFileSync(metaFor(key), 'utf8');
  } catch {
    return null;
  }
}
