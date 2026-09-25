import { BOX_PAGE_DEFAULTS } from '../../../shared/commerce/mystery-box';
import { HOUR, MINUTE, daysAgo, realNow } from './clock';
import { SHOPPERS, byKey } from './people';
import { between, pick, rand, type OrderRecord, type Story } from './story';

// Everything past the everyday orders. Words customers "wrote" are demo data and
// the showcase labels them as such.

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

/**
 * The mystery box, as the owner set it up: 5kg and 10kg sizes (the owner's
 * decision noted in server/shop/boxes/types.ts), packed by hand, from PLA Silk
 * and PLA+ (the mix server/shop/boxes/fallback.ts names). Prices are demo values:
 * the box is not on sale on the live site.
 */
export function mysteryBox(story: Story): void {
  const owner = story.owner;
  story.at(daysAgo(10, 10, 15), async () => {
    const pool = story.products
      .filter((p) => p.slug.includes('silk') || p.slug.includes('filament-2'))
      .flatMap((p) => p.variants.map((v) => v.id));
    const { mysteryBox: current } = await owner.get('/api/shop/admin/mystery-box');
    const { mysteryBox: saved } = await owner.put('/api/shop/admin/mystery-box', {
      expectedRevision: current.settings.revision,
      enabled: true,
      mode: 'pack',
      shortfall: 'hold',
      name: 'Mystery box',
      overview: 'Five or ten spools of PlaSpool PLA, picked by us from what is on the shelf.',
      page: BOX_PAGE_DEFAULTS,
      description: {
        type: 'doc',
        content: [
          para(
            'A box of PlaSpool filament, packed by hand in Abuja. You choose the size; we choose the spools.',
          ),
          para(
            'Every spool is a full 1kg of 1.75mm PLA Silk or PLA+, from the same batches we sell one at a time.',
          ),
        ],
      },
      coverImageId: null,
      imageIds: [],
      sizes: [
        {
          variantId: null,
          size: '5kg',
          itemCount: 5,
          priceMinor: 12_500_000,
          weightGrams: 5000,
          shippingWeightGrams: 5600,
          imageId: null,
        },
        {
          variantId: null,
          size: '10kg',
          itemCount: 10,
          priceMinor: 24_000_000,
          weightGrams: 10000,
          shippingWeightGrams: 11200,
          imageId: null,
        },
      ],
      main: pool,
      backup: [],
    });
    story.box = {
      sizes: saved.box.sizes.map((s: any) => ({
        variantId: s.variantId,
        size: s.size,
        itemCount: s.itemCount,
      })),
      pool,
    };
  });

  const size = (label: string) => () => {
    const found = story.box?.sizes.find((s) => s.size === label);
    if (!found) throw new Error('mystery box not set up');
    return [{ variantId: found.variantId, qty: 1 }];
  };
  const boxOrder = (key: string, when: number, label: string) =>
    story.at(when - MINUTE, async () => {
      story.order(key, when, { lines: size(label)(), box: true });
    });

  boxOrder('halima', daysAgo(9, 12, 40), '5kg');
  boxOrder('kunle', daysAgo(8, 19, 5), '10kg');
  boxOrder('zara', daysAgo(7, 9, 50), '5kg');
  boxOrder('makerspace', daysAgo(5, 11, 20), '10kg');
  boxOrder('chioma', daysAgo(3, 10, 5), '5kg');
  // Four in the last day: enough for the "bought in the last 24 hours" cue, and
  // still waiting to be packed, which is the console's fill-a-box moment.
  boxOrder('dayo', realNow() - 19 * HOUR, '5kg');
  boxOrder('ngozi', realNow() - 11 * HOUR, '5kg');
  boxOrder('segun', realNow() - 5 * HOUR, '10kg');
  boxOrder('emeka', realNow() - 2 * HOUR, '5kg');
}

const REVIEWS: Record<string, { rating: number; title: string; body: string }[]> = {
  'pla-basic': [
    {
      rating: 5,
      title: 'Clean first layers, no fuss',
      body: 'Ran a plate of calibration cubes and a nine-hour enclosure print at 205°C. No clogs, no blobs, and the spool unwound without a single tangle.',
    },
    {
      rating: 4,
      title: 'Good everyday PLA',
      body: 'Light Grey prints matte and hides layer lines well. I needed 5°C more than my old imported roll, then it was spot on.',
    },
    {
      rating: 5,
      title: 'Consistent from spool to spool',
      body: 'We print kits for the club every week. The diameter stayed the same across three spools, so we stopped recalibrating between rolls.',
    },
  ],
  'pla-silk': [
    {
      rating: 5,
      title: 'The Yellow Gold is stunning',
      body: 'Printed two vases in vase mode at 210°C. The shine is even all the way round and it looks like brushed metal on the shelf.',
    },
    {
      rating: 4,
      title: 'Beautiful finish, tune your retraction',
      body: 'Burgundy looks rich on display pieces. A little stringing on the first print; 205°C and an extra millimetre of retraction fixed it.',
    },
    {
      rating: 5,
      title: 'Gifts that look expensive',
      body: 'Printed name plates for a wedding table. Everyone asked where we bought them, and they were surprised it was printed here.',
    },
  ],
  'pla-1-75mm-3d-printer-filament-2': [
    {
      rating: 5,
      title: 'Tough enough for brackets',
      body: 'Printed shelf brackets and a phone mount. Noticeably stronger than regular PLA, and the black is a true deep black.',
    },
    {
      rating: 4,
      title: 'Solid PLA+',
      body: 'Layer adhesion is excellent. Bed at 60°C with a glue stick and nothing warped, even on long parts.',
    },
  ],
};

/** Written in the last day, so they are still in the moderation queue. */
const LATE_REVIEWS = [
  {
    slug: 'pla-silk',
    rating: 5,
    title: 'White Silk for cosplay armour',
    body: 'Printed a helmet in White Silk at 0.16mm layers. The sheen hides layer lines better than I expected, and it sanded and painted well.',
  },
  {
    slug: 'pla-basic',
    rating: 4,
    title: 'Clear works for lamp shades',
    body: 'Printed a lithophane lamp shade in Clear. Light comes through evenly; slowing down to 40mm/s gave the best finish.',
  },
];

const REPLIES: Record<string, string> = {
  'The Yellow Gold is stunning':
    'Thank you! Vase mode is exactly what Silk is for. Send us a photo of the pair and we may share it.',
  'Beautiful finish, tune your retraction':
    'Thanks for the settings, that is the same fix we use on Silk. We have added it to the Silk guide on the blog.',
};

/** Buyers with accounts review what reached them; the team approves and answers. */
export function reviews(story: Story): void {
  const written = new Set<string>();
  const queue = Object.fromEntries(
    Object.entries(REVIEWS).map(([slug, list]) => [slug, [...list]]),
  );
  const submitted: { id: string; title: string; at: number }[] = [];

  story.onDelivered.push((record: OrderRecord) => {
    if (!record.shopper.account || record.box || rand() > 0.55) return;
    const when = (record.deliveredAt ?? realNow()) + between(20, 50) * HOUR;
    story.at(when, async () => {
      const detail = await story.owner.get(`/api/shop/admin/orders/${record.orderId}`);
      for (const line of detail.lines) {
        const product = story.products.find((p) => p.variants.some((v) => v.id === line.variantId));
        if (!product || !queue[product.slug]?.length) continue;
        const key = `${record.key}:${product.slug}`;
        if (written.has(key)) continue;
        written.add(key);
        const review = queue[product.slug].shift()!;
        const session = story.session(record.key);
        await session.signIn();
        const created = await session.review({ productSlug: product.slug, ...review });
        submitted.push({ id: created.reviewId, title: review.title, at: when });
        break;
      }
    });
  });

  for (const [i, late] of LATE_REVIEWS.entries()) {
    story.at(realNow() - (9 - i * 5) * HOUR, async () => {
      const product = story.products.find((p) => p.slug.includes(late.slug));
      const buyer = story.orders.find(
        (o) =>
          o.shopper.account &&
          o.deliveredAt &&
          !written.has(`${o.key}:${product?.slug}`) &&
          story.lineProducts(o).includes(product?.slug ?? ''),
      );
      if (!product || !buyer) return;
      written.add(`${buyer.key}:${product.slug}`);
      const session = story.session(buyer.key);
      await session.signIn();
      const { slug, ...review } = late;
      void slug;
      await session.review({ productSlug: product.slug, ...review });
    });
  }

  // The team works through them each evening. The newest few are still waiting,
  // which is what the moderation queue is for.
  for (let day = 18; day >= 1; day--) {
    story.at(daysAgo(day, 18, 45), async () => {
      const cutoff = Math.min(Date.now() - 2 * HOUR, realNow() - 40 * HOUR);
      for (const review of submitted.filter((r) => r.at < cutoff)) {
        await story.owner.patch(`/api/shop/reviews/${review.id}`, { status: 'approved' });
        const reply = REPLIES[review.title];
        if (reply)
          await story.owner.post(`/api/shop/reviews/${review.id}/staff-replies`, { body: reply });
      }
      submitted.splice(0, submitted.length, ...submitted.filter((r) => r.at >= cutoff));
    });
  }
}

/** Empty spools coming home, at every stage the Spools desk has. */
export function spoolReturns(story: Story): void {
  const desk = story.staff.support ?? story.owner;
  const area = (key: string) => {
    const name = byKey(key).address.district;
    const id = name ? story.setup.areaIds[name] : undefined;
    if (!id) throw new Error(`no collection district for ${key}`);
    return id;
  };
  const drivers = [
    { name: 'Musa Ibrahim', phone: '+234 800 555 0191' },
    { name: 'Blessing Nwachukwu', phone: '+234 800 555 0192' },
  ];

  type Stage = 'requested' | 'scheduled' | 'collected' | 'received' | 'awarded';
  const journey = (key: string, qty: number, start: number, stage: Stage, rejected = 0) => {
    const who = byKey(key);
    let id = '';
    let revision = 0;
    const step = async (path: string, body: Record<string, unknown>) => {
      await desk.post(`/api/marketing/returns/${id}/${path}`, {
        expectedRevision: revision,
        ...body,
      });
      revision = (await desk.get(`/api/marketing/returns/${id}`)).request.revision;
    };
    story.at(start, async () => {
      const session = story.session(key);
      await session.signIn();
      const created = await session.requestReturn({ qty, serviceAreaId: area(key) });
      id = created.requestId;
      revision = (await desk.get(`/api/marketing/returns/${id}`)).request.revision;
    });
    if (stage === 'requested') return;
    const driver = pick(drivers);
    const pickup = start + between(20, 30) * HOUR;
    story.at(start + between(2, 5) * HOUR, () =>
      step('schedule', {
        pickupAt: pickup,
        driverName: driver.name,
        driverPhone: driver.phone,
        pickupAddress: `${who.address.line1}, ${who.address.city}`,
      }),
    );
    if (stage === 'scheduled') return;
    story.at(pickup + 40 * MINUTE, () => step('collect', {}));
    if (stage === 'collected') return;
    const received = pickup + (who.address.region === 'Lagos' ? 30 : 4) * HOUR;
    story.at(received, () => step('receive', {}));
    if (stage === 'received') return;
    story.at(received + between(18, 26) * HOUR, async () => {
      await step('costs', {
        transportMinor: who.address.region === 'Lagos' ? 1_800_000 : 0,
        localMinor: 250_000,
        driverMinor: 200_000,
        feesMinor: 50_000,
      });
      await step('inspect', {
        qtyAccepted: qty - rejected,
        qtyRejected: rejected,
        ...(rejected ? { rejectedReason: 'Cracked hubs; we can only reuse whole spools.' } : {}),
      });
    });
  };

  journey('printfarm', 80, daysAgo(15, 10, 20), 'awarded', 4);
  journey('makerspace', 55, daysAgo(10, 14, 5), 'awarded');
  journey('tunde', 60, daysAgo(8, 9, 40), 'awarded', 2);
  journey('halima', 64, daysAgo(6, 16, 30), 'received');
  journey('kunle', 52, daysAgo(3, 11, 15), 'collected');
  journey('school', 50, daysAgo(2, 13, 0), 'scheduled');
  journey('zara', 58, realNow() - 26 * HOUR, 'requested');
  journey('chioma', 60, realNow() - 4 * HOUR, 'requested');
}

/** Points earned on returns, spent at checkout. */
export function pointsSpent(story: Story): void {
  story.order('printfarm', daysAgo(6, 10, 30), { redeemPoints: 76 });
  story.order('makerspace', daysAgo(2, 15, 10), { redeemPoints: 55 });
}

/** Sales the team took outside the website and recorded by hand. */
export function handSales(story: Story): void {
  const basic = story.product('pla-basic');
  const plus = story.product('filament-2');
  const silk = story.product('pla-silk');
  const sale = (when: number, body: Record<string, unknown>) =>
    story.at(when, async () => {
      await story.owner.post('/api/shop/admin/orders/manual', {
        soldAt: new Date(when + HOUR).toISOString().slice(0, 10),
        takeFromStock: true,
        ...body,
      });
    });
  sale(daysAgo(12, 13, 10), {
    lines: [{ variantId: basic.variants[0].id, qty: 3 }],
    paymentMethod: 'cash',
    advanced: { salesChannel: 'walk_in', customer: { name: 'Walk-in, Garki' } },
  });
  sale(daysAgo(6, 15, 45), {
    lines: [{ variantId: plus.variants[0].id, qty: 10 }],
    paymentMethod: 'bank_transfer',
    paymentReference: 'TRF 0923 4471',
    advanced: {
      salesChannel: 'whatsapp',
      customer: {
        name: 'Wuse Robotics Club',
        email: 'coach@wuserobotics.example.com',
        phone: '+234 800 555 0181',
      },
      address: {
        line1: '9 Adetokunbo Ademola Crescent',
        city: 'Abuja',
        region: 'Federal Capital Territory',
        countryCode: 'NG',
      },
      shippingAmount: 300_000,
    },
  });
  sale(daysAgo(2, 11, 30), {
    lines: [
      { variantId: silk.variants[0].id, qty: 2 },
      { variantId: silk.variants[3].id, qty: 2 },
    ],
    paymentMethod: 'paystack_link',
    advanced: {
      salesChannel: 'instagram',
      customer: {
        name: 'Temi Balogun',
        email: 'temi.balogun@example.com',
        phone: '+234 800 555 0182',
      },
      address: { line1: '15 Awolowo Road', city: 'Ikoyi', region: 'Lagos', countryCode: 'NG' },
      shippingAmount: 1_000_000,
    },
  });
}

/** The newsletter list and one draft, built from the default template. */
export function newsletter(story: Story): void {
  story.at(daysAgo(1, 17, 20), async () => {
    const owner = story.owner;
    for (const shopper of SHOPPERS.filter((s) => s.account)) {
      await owner.post('/api/admin/email/subscribers', {
        email: shopper.email,
        name: shopper.name,
      });
    }
    const listed = await owner.get('/api/admin/email/templates');
    const templates: any[] = listed.templates ?? listed.items ?? [];
    const template = templates.find((t) => !t.systemKey) ?? templates[0];
    if (template) {
      await owner.post('/api/admin/email/broadcasts', {
        templateId: template.id,
        subject: 'The mystery box is here: five or ten spools, picked by us',
      });
    }
  });
}

