const local = new URL('./local-r2.ts', import.meta.url).href;

export async function resolve(specifier, context, next) {
  const resolved = await next(specifier, context);
  if (resolved.url.endsWith('/server/storage/r2.ts')) return { ...resolved, url: local };
  return resolved;
}
