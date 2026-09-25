import type { Browser } from './client';
import { uploadLive } from './catalog';
import { liveJson } from './live';
import type { Story } from './story';

/** The live journal, post for post, drafted and published when the live posts were. */
export async function schedulePosts(story: Story, writer: Browser): Promise<number> {
  const { items } = await liveJson<{ items: { slug: string }[] }>('/api/public/posts');
  for (const summary of items) {
    const { post: live } = await liveJson<{ post: any }>(`/api/public/posts/${summary.slug}`);
    let draftId = '';
    story.at(live.publishedAt - 40 * 60_000, async () => {
      const cover = live.coverImage
        ? {
            blobId: await uploadLive(writer, live.coverImage.url),
            alt: live.coverImage.alt,
            focalPoint: live.coverImage.focalPoint,
            width: live.coverImage.width,
            height: live.coverImage.height,
          }
        : null;
      const { post: draft } = await writer.post('/api/posts', { title: live.title });
      await writer.patch(`/api/posts/${draft.id}`, {
        patch: {
          title: live.title,
          subtitle: live.subtitle ?? '',
          content: live.content,
          coverImage: cover,
          category: live.category ?? '',
          tags: live.tags ?? [],
          excerpt: live.excerpt ?? '',
          template: live.template ?? null,
        },
        baseRevision: draft.revision,
        kind: 'manual',
      });
      draftId = draft.id;
    });
    story.at(live.publishedAt, async () => {
      await writer.post(`/api/posts/${draftId}/publish`);
    });
  }
  return items.length;
}
