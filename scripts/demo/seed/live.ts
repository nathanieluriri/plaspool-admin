import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_DIR } from '../env';

// The public catalogue and posts, read from the live site with GET only and kept
// in .demo-db/live so a reseed is offline and matches what was captured.

export const LIVE_API = 'https://admin.plaspool.com';
const dir = () => resolve(DEMO_DIR, 'live');
const keyOf = (path: string) => path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_');

function remember(path: string): void {
  const file = resolve(dir(), 'captured.json');
  const log = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { sources: {} };
  log.sources[`${LIVE_API}${path}`] ??= new Date().toISOString();
  writeFileSync(file, JSON.stringify(log, null, 1));
}

export async function liveJson<T = any>(path: string): Promise<T> {
  const file = resolve(dir(), `${keyOf(path)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T;
  const res = await fetch(LIVE_API + path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${LIVE_API}${path} -> ${res.status}`);
  const body = await res.json();
  mkdirSync(dir(), { recursive: true });
  writeFileSync(file, JSON.stringify(body, null, 1));
  remember(path);
  return body as T;
}

export async function liveImage(path: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const file = resolve(dir(), 'images', keyOf(path));
  if (existsSync(file) && existsSync(`${file}.type`)) {
    return {
      bytes: new Uint8Array(readFileSync(file)),
      contentType: readFileSync(`${file}.type`, 'utf8'),
    };
  }
  const res = await fetch(LIVE_API + path);
  if (!res.ok) throw new Error(`GET ${LIVE_API}${path} -> ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const contentType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
  mkdirSync(resolve(dir(), 'images'), { recursive: true });
  writeFileSync(file, bytes);
  writeFileSync(`${file}.type`, contentType);
  remember(path);
  return { bytes, contentType };
}

/** Reads every live thing the seed uses, so the seed itself never goes online. */
export async function prefetchLive(): Promise<void> {
  const { items: products } = await liveJson<{ items: { slug: string }[] }>('/api/shop/products');
  await liveJson('/api/shop/categories');
  for (const { slug } of products) {
    const { product } = await liveJson<{ product: any }>(`/api/shop/products/${slug}`);
    const images = [
      product.coverImageUrl,
      ...product.imageUrls,
      ...product.variants.map((v: any) => v.imageUrl),
    ];
    for (const url of images) if (url) await liveImage(url);
    const addOns = await liveJson<{ offers: { imageUrl: string | null }[] }>(
      `/api/shop/add-ons/for-product/${slug}`,
    );
    for (const offer of addOns.offers) if (offer.imageUrl) await liveImage(offer.imageUrl);
  }
  const { items: posts } = await liveJson<{ items: { slug: string }[] }>('/api/public/posts');
  for (const { slug } of posts) {
    const { post } = await liveJson<{ post: any }>(`/api/public/posts/${slug}`);
    if (post.coverImage?.url) await liveImage(post.coverImage.url);
  }
  await liveJson('/api/public/shop/delivery-config');
  await liveJson('/api/public/marketing/rewards');
  await liveJson('/api/public/marketing/banners');
  await liveJson('/api/public/marketing/areas');
}
