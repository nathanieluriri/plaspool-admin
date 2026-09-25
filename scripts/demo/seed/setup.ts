import type { Browser } from './client';
import { uploadLive } from './catalog';
import { liveJson } from './live';

// Store settings: live values wherever the live site shows them publicly,
// demo values (named as such below) for everything private.

export interface StoreSetup {
  addOnId: string;
  programId: string;
  areaIds: Record<string, string>;
}

export async function setupStore(owner: Browser): Promise<StoreSetup> {
  await deliveryForm(owner);
  const addOnId = await packagingAddOn(owner);
  const programId = await rewardsProgramme(owner);
  await pointsAtCheckout(owner);
  const areaIds = await collectionAreas(owner);
  await banners(owner);
  await discounts(owner);
  return { addOnId, programId, areaIds };
}

/** The address form the live checkout shows (GET /api/public/shop/delivery-config). */
async function deliveryForm(owner: Browser): Promise<void> {
  const { config: live } = await liveJson<{ config: any }>('/api/public/shop/delivery-config');
  const current = await owner.get('/api/shop/admin/delivery-settings');
  const settings = current.settings ?? current.config ?? current;
  await owner.patch('/api/shop/admin/delivery-settings', {
    expectedRevision: settings.revision,
    addressMode: live.mode,
    locationOffered: live.location?.offer ?? false,
    servedRegions: live.servedRegions ?? null,
    servedCountries: live.country?.allowed ?? ['NG'],
  });
}

/** The live "Packaging" add-on, word for word, with its own photograph. */
async function packagingAddOn(owner: Browser): Promise<string> {
  const { offers } = await liveJson<{ offers: any[] }>('/api/shop/add-ons/for-product/pla-basic');
  const live = offers[0];
  const imageId = live.imageUrl ? await uploadLive(owner, live.imageUrl) : null;
  const created = await owner.post('/api/shop/admin/add-ons', {
    title: live.title,
    description: live.description,
    imageId,
    priceMinor: live.price.amount,
    status: 'active',
    rules: [{ when: [], then: live.mode, basis: live.basis }],
  });
  return (created.addOn ?? created).id;
}

/** The live programme's words and numbers (GET /api/public/marketing/rewards). */
async function rewardsProgramme(owner: Browser): Promise<string> {
  const { program: live } = await liveJson<{ program: any }>('/api/public/marketing/rewards');
  const { programs } = await owner.get('/api/marketing/programs');
  const programme = programs.find((p: any) => p.kind === 'unit_return') ?? programs[0];
  await owner.patch(`/api/marketing/programs/${programme.id}`, {
    expectedRevision: programme.revision,
    name: live.name,
    pointsLabelSingular: live.pointsLabelSingular,
    pointsLabelPlural: live.pointsLabelPlural,
    unitLabelSingular: live.unitLabelSingular,
    unitLabelPlural: live.unitLabelPlural,
    minUnitsPerReturn: live.minUnitsPerReturn,
    pointsPerUnit: live.pointsPerUnit,
  });
  return programme.id;
}

/** A point is worth ₦100 at checkout: the figure the storefront's returns intro states. */
async function pointsAtCheckout(owner: Browser): Promise<void> {
  const current = await owner.get('/api/marketing/settings');
  const settings = current.settings ?? current;
  await owner.patch('/api/marketing/settings', {
    expectedRevision: settings.revision,
    redemptionEnabled: true,
    redemptionRatePoints: 1,
    redemptionRateMinor: 10_000,
    redemptionCurrency: 'NGN',
  });
}

/** The districts the live site collects from, switched on here too. */
async function collectionAreas(owner: Browser): Promise<Record<string, string>> {
  const { areas: live } = await liveJson<{ areas: { key: string; name: string }[] }>(
    '/api/public/marketing/areas',
  );
  const wanted = new Set(live.map((a) => a.key));
  const ids: Record<string, string> = {};
  const page: any = await owner.get('/api/marketing/areas');
  for (const area of page.areas ?? page.items ?? []) {
    if (!wanted.has(area.key)) continue;
    ids[area.name] = area.id;
    if (area.active) continue;
    await owner.patch(`/api/marketing/areas/${area.id}`, {
      expectedRevision: area.revision,
      active: true,
      // Demo figures for what a pickup costs, which the Spools analytics read.
      stdTransportMinor: area.region === 'Lagos' ? 1_500_000 : 0,
      stdLocalMinor: 250_000,
      stdDriverMinor: 200_000,
      stdFeesMinor: 50_000,
    });
  }
  return ids;
}

/** The live top bar, word for word. */
async function banners(owner: Browser): Promise<void> {
  const { banners: live } = await liveJson<{ banners: any[] }>('/api/public/marketing/banners');
  for (const banner of live) {
    const created = await owner.post('/api/marketing/banners', {
      title: banner.title,
      body: banner.body ?? '',
      ctaText: banner.ctaText,
      ctaUrl: banner.ctaUrl,
      placement: banner.placement,
      priority: banner.priority,
    });
    const row = created.banner ?? created;
    if (row.status !== 'live') {
      await owner.patch(`/api/marketing/banners/${row.id}`, {
        expectedRevision: row.revision,
        status: 'live',
      });
    }
  }
}

/** Demo codes. SPOOL10 is the example the storefront's own code field shows. */
async function discounts(owner: Browser): Promise<void> {
  const day = 86_400_000;
  await owner.post('/api/marketing/discounts', {
    kind: 'percent',
    code: 'SPOOL10',
    percentBps: 1000,
    note: 'First order, from the launch posts.',
  });
  await owner.post('/api/marketing/discounts', {
    kind: 'fixed_amount',
    code: 'ABUJAMAKERS',
    amountMinor: 500_000,
    currency: 'NGN',
    maxRedemptions: 50,
    note: 'Handed out at the Abuja maker meetup.',
  });
  await owner.post('/api/marketing/discounts', {
    kind: 'percent',
    code: 'STEMCLUB15',
    percentBps: 1500,
    maxRedemptions: 20,
    endsAt: Date.now() + 60 * day,
    note: 'School clubs this term.',
  });
}
