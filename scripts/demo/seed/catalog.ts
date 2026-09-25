import type { Browser } from './client';
import { realNow, setNow } from './clock';
import { liveImage, liveJson } from './live';

export interface SeededVariant {
  id: string;
  sku: string;
  colour: string;
  size: string;
  amount: number;
  colorHex: string | null;
}

export interface SeededProduct {
  id: string;
  slug: string;
  title: string;
  publishedAt: number;
  variants: SeededVariant[];
}

// Stock is private, so the demo sets its own opening counts.
const DEMO_STOCK = [60, 45, 40, 70, 30, 55, 40, 65, 50, 35];

const uploaded = new Map<string, string>();

/** A live image, uploaded through the console's own slot, PUT and commit. */
export async function uploadLive(owner: Browser, livePath: string): Promise<string> {
  const cached = uploaded.get(livePath);
  if (cached) return cached;
  const { bytes, contentType } = await liveImage(livePath);
  const slot = await owner.post('/api/images', {
    contentType,
    byteSize: bytes.byteLength,
  });
  const put = await owner.request('PUT', slot.uploadUrl, bytes, slot.headers);
  if (!put.ok) throw new Error(`upload ${livePath} -> ${put.status}`);
  await owner.post(`/api/images/${slot.id}/commit`);
  uploaded.set(livePath, slot.id);
  return slot.id;
}

function colourOf(options: Record<string, string>): string {
  return options.Colour ?? options.Color ?? 'Default';
}

export async function seedCatalog(owner: Browser): Promise<SeededProduct[]> {
  const { items } = await liveJson<{ items: { slug: string }[] }>('/api/shop/products');
  const categories = await liveJson<{
    items: {
      name: string;
      blurb: string;
      accentHex: string | null;
      position: number;
    }[];
  }>('/api/shop/categories');
  const lives = await Promise.all(
    items.map(
      async ({ slug }) => (await liveJson<{ product: any }>(`/api/shop/products/${slug}`)).product,
    ),
  );
  lives.sort((a, b) => a.createdAt - b.createdAt);

  // Each product is created at the moment the live one was; publishing is queued
  // for its own live moment (schedulePublishing).
  const at = (when: number) => setNow(Math.min(when, realNow() - 60_000));
  at(lives[0].createdAt - 20 * 60_000);
  for (const category of categories.items) {
    await owner.post('/api/shop/admin/categories', {
      name: category.name,
      blurb: category.blurb,
      accentHex: category.accentHex,
      position: category.position,
    });
  }

  const products: SeededProduct[] = [];
  let stock = 0;
  for (const live of lives) {
    const slug: string = live.slug;
    at(live.createdAt);
    const imageFor = new Map<string, string>();
    for (const [i, liveId] of (live.imageIds as string[]).entries()) {
      imageFor.set(liveId, await uploadLive(owner, live.imageUrls[i]));
    }
    if (live.coverImageId)
      imageFor.set(live.coverImageId, await uploadLive(owner, live.coverImageUrl));
    for (const variant of live.variants) {
      if (variant.imageId && variant.imageUrl && !imageFor.has(variant.imageId)) {
        imageFor.set(variant.imageId, await uploadLive(owner, variant.imageUrl));
      }
    }

    // A slug is fixed by the first title, so the product is born under its live
    // slug's words and renamed at once.
    const { product: born } = await owner.post('/api/shop/admin/products', {
      title: slug.replace(/-/g, ' '),
    });
    const { product } = await owner.patch(`/api/shop/admin/products/${born.id}`, {
      baseRevision: born.revision,
      patch: {
        title: live.title,
        description: live.description,
        category: live.category,
        tags: live.tags,
        coverImageId: live.coverImageId ? imageFor.get(live.coverImageId) : null,
        imageIds: (live.imageIds as string[]).map((id) => imageFor.get(id)),
        seoTitle: live.seoTitle,
        seoDescription: live.seoDescription,
        overview: live.overview,
        bulkDiscountEnabled: live.bulkDiscountEnabled,
      },
    });

    const variants: SeededVariant[] = [];
    for (const variant of live.variants) {
      // The live data spells the option key both ways; one key keeps one picker.
      const colour = colourOf(variant.optionValues);
      const size = variant.optionValues.Size ?? '1kg';
      const { variant: made } = await owner.post(
        `/api/shop/admin/products/${product.id}/variants`,
        {
          sku: variant.sku,
          optionValues: { Size: size, Colour: colour },
          position: variant.position,
          weightGrams: variant.weightGrams,
          onHand: DEMO_STOCK[stock++ % DEMO_STOCK.length],
          backorderable: false,
          imageId: variant.imageId ? (imageFor.get(variant.imageId) ?? null) : null,
          colorHex: variant.colorHex,
          compareAtMinor: variant.compareAtMinor,
          // Demo cost price, about 60% of the selling price, for Analytics' profit chart.
          costMinor: Math.round((variant.price.amount * 0.6) / 10_000) * 10_000,
        },
      );
      await owner.put(`/api/shop/admin/variants/${made.id}/price`, {
        amount: variant.price.amount,
        currency: variant.price.currency,
      });
      variants.push({
        id: made.id,
        sku: variant.sku,
        colour,
        size,
        amount: variant.price.amount,
        colorHex: variant.colorHex,
      });
    }

    if (live.bulkTiers?.length) {
      await owner.put(`/api/shop/admin/products/${product.id}/bulk-tiers`, {
        tiers: live.bulkTiers,
      });
    }
    products.push({
      id: product.id,
      slug: product.slug,
      title: product.title,
      publishedAt: live.publishedAt,
      variants,
    });
  }
  return products;
}

export function schedulePublishing(
  story: { at: (when: number, run: () => Promise<void>) => void },
  owner: Browser,
  products: SeededProduct[],
): void {
  for (const product of products) {
    story.at(Math.min(product.publishedAt, realNow() - 120_000), async () => {
      await owner.post(`/api/shop/admin/products/${product.id}/publish`);
    });
  }
}
