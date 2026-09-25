import type { Hono } from 'hono';
import type { DemoProvider } from '../app';
import type { Browser } from './client';
import { HOUR, MINUTE, daysAgo, realNow, setNow } from './clock';
import type { SeededProduct, SeededVariant } from './catalog';
import { SHOPPERS, byKey, type Shopper } from './people';
import { ShopperSession, type Line, type Placed } from './shop';
import type { StoreSetup } from './setup';

// Three weeks of trading, from the week the live catalogue went up to today.
// Every step is queued at its own moment and the queue runs in time order, so
// the app's clock only ever moves forward. Seeded, so a reseed draws the same
// screens.

export interface OrderRecord {
  key: string;
  shopper: Shopper;
  placedAt: number;
  placed: Placed;
  lines: Line[];
  paid: boolean;
  box: boolean;
  orderId?: string;
  orderNumber?: string;
  fulfillmentId?: string;
  deliveredAt?: number;
}

interface Step {
  at: number;
  seq: number;
  run: () => Promise<void>;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(20260925);
export const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
export const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

/** Orders per day, oldest first: a quiet opening, then word of mouth. */
const DAILY = [1, 1, 2, 1, 2, 2, 3, 2, 3, 2, 3, 3, 4, 3, 3, 4, 3, 4, 4, 3];
const REPEAT_BUYERS = ['chioma', 'makerspace', 'printfarm', 'halima', 'tunde', 'kunle', 'school'];
const ABUJA = 'Federal Capital Territory';

const watHour = (t: number) => new Date(t + HOUR).getUTCHours();

/** Riders and couriers move between 9am and 7pm; anything else waits for the next window. */
function workingHours(t: number): number {
  const hour = watHour(t);
  if (hour >= 9 && hour < 19) return t;
  const d = new Date(t + HOUR);
  const nextDay = hour >= 19 ? 1 : 0;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + nextDay,
    8 + between(1, 3),
    between(0, 59),
  );
}

function nextMorning(t: number): number {
  const d = new Date(t + HOUR);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 8, between(5, 50));
}

export class Story {
  readonly orders: OrderRecord[] = [];
  /** Filled in once the mystery box is set up: its sizes and what may go inside. */
  box: { sizes: { variantId: string; size: string; itemCount: number }[]; pool: string[] } | null =
    null;
  onDelivered: ((record: OrderRecord) => void)[] = [];
  private readonly sessions = new Map<string, ShopperSession>();
  private readonly queue: Step[] = [];
  private seq = 0;

  constructor(
    private readonly app: Hono<any>,
    private readonly provider: DemoProvider,
    readonly owner: Browser,
    readonly staff: Record<string, Browser>,
    readonly products: SeededProduct[],
    readonly setup: StoreSetup,
  ) {}

  at(when: number, run: () => Promise<void>): void {
    if (!Number.isFinite(when) || when > realNow() - MINUTE) return;
    this.queue.push({ at: when, seq: this.seq++, run });
  }

  async run(): Promise<void> {
    while (this.queue.length > 0) {
      this.queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const step = this.queue.shift()!;
      setNow(step.at);
      await step.run();
    }
  }

  session(key: string): ShopperSession {
    let s = this.sessions.get(key);
    if (!s) {
      s = new ShopperSession(this.app, byKey(key), this.provider);
      this.sessions.set(key, s);
    }
    return s;
  }

  product(slugPart: string): SeededProduct {
    const found = this.products.find((p) => p.slug.includes(slugPart));
    if (!found) throw new Error(`no product ${slugPart}`);
    return found;
  }

  /** The product slugs an order bought, from the basket it was placed with. */
  lineProducts(record: OrderRecord): string[] {
    return record.lines
      .map(
        (line) => this.products.find((p) => p.variants.some((v) => v.id === line.variantId))?.slug,
      )
      .filter((slug): slug is string => Boolean(slug));
  }

  /** What was on sale at this moment. */
  onSale(): SeededProduct[] {
    return this.products.filter((p) => p.publishedAt <= Date.now());
  }

  variant(slugPart: string, colour?: string): SeededVariant {
    const product = this.product(slugPart);
    return colour
      ? (product.variants.find((v) => v.colour === colour) ?? product.variants[0])
      : pick(product.variants);
  }

  /** A basket this kind of buyer would plausibly fill. */
  basket(shopper: Shopper): Line[] {
    const farm = ['printfarm', 'makerspace', 'school'].includes(shopper.key);
    const shelf = this.onSale();
    if (farm) {
      const product = pick(shelf);
      const colours = [...product.variants].sort(() => rand() - 0.5).slice(0, 2);
      return colours.map((v) => ({ variantId: v.id, qty: between(3, 6) }));
    }
    if (rand() < 0.28) {
      const product = pick(shelf);
      const colours = [...product.variants].sort(() => rand() - 0.5).slice(0, 2);
      return colours.map((v, i) => ({
        variantId: v.id,
        qty: i === 0 ? between(3, 4) : between(2, 3),
      }));
    }
    const first = pick(pick(shelf).variants);
    const lines: Line[] = [{ variantId: first.id, qty: between(1, 2) }];
    if (rand() < 0.35) {
      const second = pick(pick(shelf).variants);
      if (second.id !== first.id) lines.push({ variantId: second.id, qty: 1 });
    }
    return lines;
  }

  /** Queue an order and, if it is paid, everything that follows it up to now. */
  order(
    key: string,
    when: number,
    options: {
      lines?: Line[];
      pay?: boolean;
      discountCode?: string;
      redeemPoints?: number;
      box?: boolean;
      keepAddOn?: boolean;
      then?: (record: OrderRecord) => void;
    } = {},
  ): void {
    this.at(when, async () => {
      const session = this.session(key);
      await session.signIn();
      const lines = options.lines ?? this.basket(session.who);
      const placed = await session.place({
        lines,
        pay: false,
        discountCode: options.discountCode,
        redeemPoints: options.redeemPoints,
        declineAddOn: options.keepAddOn === false ? this.setup.addOnId : undefined,
      });
      if (!placed) return;
      const record: OrderRecord = {
        key,
        shopper: session.who,
        placedAt: when,
        placed,
        lines,
        paid: options.pay !== false,
        box: options.box === true,
      };
      this.orders.push(record);
      if (!record.paid) return;
      this.at(when + between(2, 9) * MINUTE, async () => {
        await session.pay(placed);
        await this.identify(record);
        if (options.then) options.then(record);
        else this.fulfil(record);
      });
    });
  }

  private async identify(record: OrderRecord): Promise<void> {
    const { items } = await this.owner.get(
      `/api/shop/admin/orders?search=${encodeURIComponent(record.shopper.email)}&limit=100`,
    );
    const found = items.find((item: any) => item.order.checkoutId === record.placed.cartId);
    if (!found) throw new Error(`no order for checkout ${record.placed.cartId}`);
    record.orderId = found.order.id;
    record.orderNumber = found.order.orderNumber;
  }

  /** Packed the same day if it came in before 1pm, else next morning; the courier does the rest. */
  fulfil(record: OrderRecord, packAt?: number): void {
    // The newest orders are still on the packing table, as they would be.
    const age = realNow() - record.placedAt;
    if (age < 20 * HOUR) return;
    const pack =
      packAt ??
      (watHour(record.placedAt) < 13
        ? record.placedAt + between(2, 3) * HOUR
        : nextMorning(record.placedAt));
    const abuja = record.shopper.address.region === ABUJA;
    const ship = age < 30 * HOUR ? Infinity : workingHours(pack + between(2, 5) * HOUR);
    const deliver = workingHours(ship + (abuja ? between(3, 20) * HOUR : between(40, 90) * HOUR));
    const packer = this.staff.supply ?? this.owner;

    if (record.box) this.at(pack - 40 * MINUTE, () => this.fillBoxes(record, packer));
    this.at(pack, async () => {
      const { lines } = await packer.get(`/api/shop/admin/orders/${record.orderId}`);
      const { fulfillment } = await packer.post(
        `/api/shop/admin/orders/${record.orderId}/fulfillments`,
        {
          lines: lines.map((line: any) => ({ orderLineId: line.id, qty: line.qty })),
        },
      );
      record.fulfillmentId = fulfillment.id;
    });
    this.at(ship, async () => {
      await packer.patch(`/api/shop/admin/fulfillments/${record.fulfillmentId}`, {
        status: 'shipped',
        carrier: abuja ? 'PlaSpool rider' : 'Fez Delivery',
        trackingNumber: abuja ? null : `FEZ-${between(100000, 999999)}`,
      });
    });
    this.at(deliver, async () => {
      await packer.patch(`/api/shop/admin/fulfillments/${record.fulfillmentId}`, {
        status: 'delivered',
      });
      record.deliveredAt = deliver;
      for (const hook of this.onDelivered) hook(record);
    });
  }

  /** Each box on the order, packed by hand from what may go inside and is on the shelf. */
  async fillBoxes(record: OrderRecord, packer: Browser): Promise<void> {
    if (!this.box) return;
    const detail = await packer.get(`/api/shop/admin/orders/${record.orderId}`);
    const { items } = await packer.get('/api/shop/admin/inventory?limit=100');
    const shelf = new Map<string, number>(items.map((r: any) => [r.variantId, r.available]));
    for (const line of detail.lines) {
      const size = this.box.sizes.find((s) => s.variantId === line.variantId);
      if (!size) continue;
      for (let boxNo = 1; boxNo <= line.qty; boxNo++) {
        const picked: string[] = [];
        const pool = [...this.box.pool].sort(() => rand() - 0.5);
        while (picked.length < size.itemCount) {
          const next = pool.find(
            (id) => (shelf.get(id) ?? 0) > 0 && picked.filter((p) => p === id).length < 2,
          );
          if (!next) break;
          picked.push(next);
          shelf.set(next, (shelf.get(next) ?? 0) - 1);
          pool.push(pool.splice(pool.indexOf(next), 1)[0]);
        }
        await packer.put(
          `/api/shop/admin/orders/${record.orderId}/lines/${line.id}/boxes/${boxNo}`,
          {
            variantIds: picked,
            expectedFilledAt: null,
          },
        );
      }
    }
  }

  /** The everyday orders, day by day, from twenty days ago to today. */
  trade(): void {
    const seen = new Set<string>();
    for (const [i, count] of DAILY.entries()) {
      const day = DAILY.length - 1 - i;
      for (let n = 0; n < count; n++) {
        const shopper = rand() < 0.45 ? byKey(pick(REPEAT_BUYERS)) : pick(SHOPPERS);
        const hour =
          day === 0
            ? pick([8, 9, 10, 11, 12, 13, 14])
            : pick([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21]);
        const newcomer = !seen.has(shopper.key);
        seen.add(shopper.key);
        this.order(shopper.key, daysAgo(day, hour, between(0, 59)), {
          discountCode: newcomer && rand() < 0.3 ? 'SPOOL10' : undefined,
          keepAddOn: rand() < 0.2 ? false : undefined,
        });
      }
    }
  }

  /** Checkouts that reached the payment page and stopped: baskets, not orders. */
  unpaid(): void {
    this.order('funke', realNow() - 3 * HOUR, { pay: false });
    this.order('obinna', realNow() - 26 * HOUR, { pay: false });
  }

  /** A batch off the line every few days, booked in by supply chain. */
  restocks(): void {
    const clerk = this.staff.supply ?? this.owner;
    let batch = 14;
    for (const day of [18, 14, 10, 7, 4, 1]) {
      const run = batch++;
      this.at(daysAgo(day, 16, between(0, 40)), async () => {
        const { items } = await clerk.get('/api/shop/admin/inventory?limit=100');
        const level = new Map<string, number>(items.map((r: any) => [r.variantId, r.available]));
        for (const product of this.onSale()) {
          for (const variant of product.variants) {
            if ((level.get(variant.id) ?? 0) > 25) continue;
            await clerk.post(`/api/shop/admin/inventory/${variant.id}/adjust`, {
              delta: between(30, 45),
              reason: `Batch ${run} off the line`,
            });
          }
        }
      });
    }
  }

  /** The owner's sweep, run as the 10-minute cron would, so emails go out. */
  sweeps(): void {
    for (let day = 20; day >= 0; day--) {
      for (const hour of [9, 13, 18, 22]) {
        this.at(daysAgo(day, hour, 30), async () => {
          await this.owner.post('/api/shop/admin/sweep', {});
        });
      }
    }
  }
}
