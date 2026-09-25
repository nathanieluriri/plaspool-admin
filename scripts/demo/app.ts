import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { createApp } from '../../server/index';
import { SESSION_COOKIE } from '../../server/middleware/session';
import { createSession } from '../../server/repo/users';
import { resetOrdersDeps } from '../../server/shop/orders/ports';
import type { Db } from '../../server/db/client';
import type { Mailer } from '../../server/mail/port';
import { FakeProvider } from '../../server/shop/payments/provider/fake';
import type {
  CreateIntentRequest,
  ProviderIntent,
} from '../../server/shop/payments/provider/types';
import { CONSOLE_ORIGIN, DEMO_DIR, STOREFRONT } from './env';
import { OBJECT_ROUTE, putObject, readObject } from './local-r2';
import { SHOPPERS } from './seed/people';
import { assertionFor } from './seed/shop';
import { TEAM } from './seed/team';

// Stands in for Paystack. Checkout hands the buyer to /api/__pay/<ref>, which
// marks the payment paid and returns them to the storefront the way Paystack does.
export class DemoProvider extends FakeProvider {
  constructor() {
    super({ name: 'paystack' });
  }

  override async createIntent(req: CreateIntentRequest): Promise<ProviderIntent> {
    const intent = await super.createIntent(req);
    const next = req.callbackUrl ?? `${STOREFRONT}/checkout/complete`;
    const url = `/api/__pay/${encodeURIComponent(req.reference)}?next=${encodeURIComponent(next)}`;
    return { ...intent, authorizationUrl: `${apiOrigin()}${url}` };
  }
}

const apiOrigin = () => `http://localhost:${process.env.DEMO_API_PORT ?? 8787}`;

export function demoMailer(): Mailer {
  const dir = resolve(DEMO_DIR, 'mail');
  let n = 0;
  return {
    async send(msg) {
      mkdirSync(dir, { recursive: true });
      const slug = msg.subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 60);
      const name = `${new Date(Date.now()).toISOString().replace(/[:.]/g, '-')}-${++n}-${slug}.html`;
      writeFileSync(resolve(dir, name), `<!-- to: ${msg.to} | ${msg.subject} -->\n${msg.html}`);
    },
  };
}

export function demoApp(db: Db, provider: DemoProvider) {
  // Importing server/index builds its default app, whose Resend mailer would
  // otherwise stay registered for order email ahead of this one.
  resetOrdersDeps();
  const app = createApp({
    db,
    origins: [CONSOLE_ORIGIN, STOREFRONT],
    mailer: demoMailer(),
    provider,
    factories: { paystack: () => provider, flutterwave: () => provider },
  });

  const outer = new Hono();
  outer.put(`${OBJECT_ROUTE}*`, async (c) => {
    const key = c.req.path.slice(OBJECT_ROUTE.length);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    await putObject(key, bytes, c.req.header('content-type') ?? 'application/octet-stream');
    return c.body(null, 200, { etag: '"demo"' });
  });
  outer.get(`${OBJECT_ROUTE}*`, (c) => {
    const found = readObject(c.req.path.slice(OBJECT_ROUTE.length));
    if (!found) return c.notFound();
    return c.body(new Uint8Array(found.bytes), 200, {
      'content-type': found.contentType,
      'cache-control': 'public, max-age=3600',
    });
  });
  outer.get('/api/__pay/:ref', (c) => {
    const ref = c.req.param('ref');
    provider.settle(ref, 'captured');
    const next = new URL(c.req.query('next') ?? `${STOREFRONT}/checkout/complete`);
    next.searchParams.set('reference', ref);
    next.searchParams.set('trxref', ref);
    return c.redirect(next.toString(), 302);
  });
  // Sign-in for the demo only: a session is minted the way the test suite mints
  // one, for a seeded demo account, so no password or Google account is needed.
  outer.get('/api/__demo/sign-in', async (c) => {
    const who = TEAM.find((m) => m.key === (c.req.query('as') ?? 'owner'));
    if (!who) return c.text(`unknown team member; try ${TEAM.map((m) => m.key).join(', ')}`, 404);
    const res = await db.execute(sql`SELECT id FROM users WHERE email = ${who.email}`);
    if (!res.rows[0]) return c.text('not seeded yet', 409);
    const { token, expiresAt } = await createSession(db, String(res.rows[0].id), 'plaspool demo');
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: Math.floor((expiresAt - Date.now()) / 1000),
    });
    return c.redirect(c.req.query('next') ?? '/#/home', 302);
  });
  outer.get('/api/__demo/shop-sign-in', async (c) => {
    const who = SHOPPERS.find((s) => s.key === (c.req.query('as') ?? 'chioma') && s.account);
    if (!who) return c.text('unknown shopper, or one who checks out as a guest', 404);
    const exchanged = await app.request('/api/shop/customer/session/exchange', {
      method: 'POST',
      headers: { origin: STOREFRONT, 'content-type': 'application/json' },
      body: JSON.stringify({ assertion: assertionFor(who.email) }),
    });
    if (!exchanged.ok) return c.text(await exchanged.text(), 502);
    const res = c.redirect(c.req.query('next') ?? `${STOREFRONT}/account`, 302);
    for (const cookie of exchanged.headers.getSetCookie()) res.headers.append('set-cookie', cookie);
    return res;
  });
  outer.all('*', (c) => app.fetch(c.req.raw));
  return { app, outer };
}
