import { rmSync } from 'node:fs';
import { register } from 'node:module';
import { resolve } from 'node:path';
import { API_PORT, CONSOLE_ORIGIN, DEMO_DIR, STOREFRONT } from './env';

register('./resolve-r2.mjs', import.meta.url);

if (process.argv.includes('--reset')) {
  for (const part of ['pg', 'objects', 'mail'])
    rmSync(resolve(DEMO_DIR, part), { recursive: true, force: true });
}

const { serve } = await import('@hono/node-server');
const { openDemoDb } = await import('./db');
const { DemoProvider, demoApp } = await import('./app');

const { db, fresh } = await openDemoDb();
const provider = new DemoProvider();

if (fresh) {
  const { seed } = await import('./seed');
  await seed(db, provider);
}

const { outer } = demoApp(db, provider);
serve({ fetch: outer.fetch, port: API_PORT });

console.log(`
demo api     http://localhost:${API_PORT}   (data in ${DEMO_DIR})
console      ${CONSOLE_ORIGIN}   npm run demo:console, then open ${CONSOLE_ORIGIN}/api/__demo/sign-in
storefront   ${STOREFRONT}   in plaspool-storefront: npm run demo
shopper      http://localhost:${API_PORT}/api/__demo/shop-sign-in?as=chioma
`);
