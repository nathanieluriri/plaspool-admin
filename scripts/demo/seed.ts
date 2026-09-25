import type { Db } from '../../server/db/client';
import { setRevalidateTransport, settleRevalidations } from '../../server/shop/catalog/revalidate';
import { demoApp, type DemoProvider } from './app';
import { CONSOLE_ORIGIN, STOREFRONT } from './env';
import { Browser } from './seed/client';
import { installClock, realNow, setNow, uninstallClock } from './seed/clock';
import { schedulePublishing, seedCatalog } from './seed/catalog';
import { schedulePosts } from './seed/content';
import { prefetchLive } from './seed/live';
import { setupStore } from './seed/setup';
import {
  handSales,
  mysteryBox,
  newsletter,
  pointsSpent,
  reviews,
  spoolReturns,
} from './seed/chapters';
import { Story } from './seed/story';
import { seedTeam, sessionFor } from './seed/team';

export async function seed(db: Db, provider: DemoProvider): Promise<void> {
  // Everything from the live site is read before the clock moves: Node's own
  // timers go wrong when Date.now() jumps under an open connection.
  await prefetchLive();

  const { outer } = demoApp(db, provider);
  setRevalidateTransport(async () => new Response(null, { status: 204 }));
  const quiet = console.info;
  console.info = () => {};
  installClock();
  try {
    // Sessions are minted at the real time so they stay valid at every moment
    // the seed visits, all of which are earlier.
    const team = await seedTeam(db);
    const staff: Record<string, Browser> = {};
    for (const key of Object.keys(team)) {
      staff[key] = new Browser(outer, CONSOLE_ORIGIN);
      staff[key].jar.set('__Host-studio_session', await sessionFor(db, team[key]));
    }
    const owner = staff.owner;

    const products = await seedCatalog(owner);
    log(
      `catalogue     ${products.length} products, ${products.flatMap((p) => p.variants).length} variants`,
    );

    const setup = await setupStore(owner);
    log('store         add-on, rewards programme, collection districts, banner, discount codes');

    const story = new Story(outer, provider, owner, staff, products, setup);
    schedulePublishing(story, owner, products);
    story.restocks();
    story.trade();
    mysteryBox(story);
    reviews(story);
    spoolReturns(story);
    pointsSpent(story);
    handSales(story);
    newsletter(story);
    story.unpaid();
    story.sweeps();
    const posts = await schedulePosts(story, staff.writer);
    await story.run();
    log(`orders        ${story.orders.length}`);
    log(`journal       ${posts} posts`);

    setNow(realNow() - 60_000);
    await owner.post('/api/shop/admin/sweep', {});
  } finally {
    uninstallClock();
    console.info = quiet;
    await settleRevalidations();
    setRevalidateTransport(null);
  }
  await purgeStorefront();
}

/** A storefront already running holds the last seed's catalogue; tell it to drop it. */
async function purgeStorefront(): Promise<void> {
  try {
    await fetch(`${STOREFRONT}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Not running: it will read fresh data when it starts.
  }
}

function log(line: string): void {
  process.stdout.write(`seed: ${line}\n`);
}
