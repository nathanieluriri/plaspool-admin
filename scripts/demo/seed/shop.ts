import { createHmac, randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import type { DemoProvider } from '../app';
import { BRIDGE_SECRET, STOREFRONT } from '../env';
import { Browser } from './client';
import type { Shopper } from './people';

// A shopper's side of the store, driven through the same routes the storefront
// calls, so every order, hold, total and email is the app's own work.

export interface Line {
  variantId: string;
  qty: number;
}

export interface PlaceOptions {
  lines: Line[];
  discountCode?: string;
  redeemPoints?: number;
  declineAddOn?: string;
  pay?: boolean;
}

export interface Placed {
  cartId: string;
  intentId: string;
  reference: string;
  grandTotal: number;
}

let ipSeq = 10;

/** The storefront's bridge assertion, signed with the demo admin's own key. */
export function assertionFor(email: string): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: `user_demo_${email.split('@')[0].replace(/[^a-z0-9]/gi, '')}`,
      email,
      iat: now,
      exp: now + 60_000,
      jti: randomBytes(16).toString('base64url'),
    }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', BRIDGE_SECRET).update(payload).digest('base64url')}`;
}

export class ShopperSession {
  readonly browser: Browser;

  constructor(
    app: Hono<any>,
    readonly who: Shopper,
    private readonly provider: DemoProvider,
  ) {
    this.browser = new Browser(app, STOREFRONT, `192.0.2.${ipSeq++}`);
  }

  async signIn(): Promise<void> {
    if (!this.who.account) return;
    await this.browser.post('/api/shop/customer/session/exchange', {
      assertion: assertionFor(this.who.email),
    });
  }

  async place(options: PlaceOptions): Promise<Placed | null> {
    const b = this.browser;
    b.jar.delete('__Host-shop_cart');
    const lines: Line[] = [];
    for (const line of options.lines) {
      const stock = await b.get(`/api/shop/variants/${line.variantId}/availability`);
      const room = stock.canFill ?? stock.available;
      const qty = typeof room === 'number' ? Math.min(line.qty, room) : line.qty;
      if (qty > 0) lines.push({ variantId: line.variantId, qty });
    }
    if (lines.length === 0) return null;
    const { cart } = await b.post('/api/shop/cart', {});
    for (const line of lines) {
      await b.post('/api/shop/cart/lines', { variantId: line.variantId, qty: line.qty });
    }
    await b.post('/api/shop/checkout/start');
    const { options: offers } = await b.put('/api/shop/checkout/addresses', {
      shipping: {
        name: this.who.name,
        line1: this.who.address.line1,
        city: this.who.address.city,
        region: this.who.address.region,
        countryCode: 'NG',
        phone: this.who.phone,
      },
    });
    if (!offers?.length) throw new Error(`no delivery option for ${this.who.address.city}`);
    await b.put('/api/shop/checkout/shipping', { optionId: offers[0].id });
    if (options.discountCode) {
      await b.post('/api/shop/checkout/discount', { code: options.discountCode });
    }
    if (options.declineAddOn) {
      await b.put(`/api/shop/checkout/add-ons/${options.declineAddOn}`, { choice: 'declined' });
    }
    const { totals } = await b.post(
      '/api/shop/checkout/freeze',
      options.redeemPoints ? { redeemPoints: options.redeemPoints } : {},
    );
    const intent = await b.post('/api/shop/payments/intents', {
      checkoutId: cart.id,
      email: this.who.email,
      idempotencyKey: `ckout_${cart.id}_1`,
    });
    const reference = decodeURIComponent(
      String(intent.authorizationUrl).match(/__pay\/([^?]+)/)?.[1] ?? '',
    );
    const placed = {
      cartId: cart.id,
      intentId: intent.id,
      reference,
      grandTotal: totals.grandTotal.amount,
    };
    if (options.pay !== false) await this.pay(placed);
    return placed;
  }

  async pay(placed: Placed): Promise<void> {
    this.provider.settle(placed.reference, 'captured');
    await this.browser.post(`/api/shop/payments/intents/${placed.intentId}/confirm`);
  }

  async review(input: { productSlug: string; rating: number; title?: string; body: string }) {
    return this.browser.post('/api/shop/reviews/submit', {
      ...input,
      authorName: this.who.org ? this.who.name : this.who.name.split(' ')[0],
    });
  }

  async requestReturn(input: { qty: number; serviceAreaId: string }) {
    return this.browser.post('/api/marketing/me/returns', {
      qtyDeclared: input.qty,
      phone: this.who.phone,
      pickupAddress: `${this.who.address.line1}, ${this.who.address.city}`,
      serviceAreaId: input.serviceAreaId,
      name: this.who.name,
    });
  }
}
