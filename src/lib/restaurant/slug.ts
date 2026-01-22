export function slugifyRestaurantName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function randomSuffix(len: number) {
  // URL-safe base36 suffix
  return Math.random().toString(36).slice(2, 2 + len);
}

export async function ensureUniqueRestaurantSlug(
  baseSlug: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  if (!slug) slug = randomSuffix(8);

  if (!(await exists(slug))) return slug;

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${baseSlug}-${randomSuffix(4)}`;
    if (!(await exists(candidate))) return candidate;
  }

  // Extremely unlikely fallback
  return `${baseSlug}-${Date.now().toString(36)}`;
}
