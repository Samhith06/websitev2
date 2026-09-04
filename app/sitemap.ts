import type { MetadataRoute } from 'next';

/**
 * The public pages only. Admin, the API and anything per-account are absent by
 * design rather than by omission — a sitemap is a list of what we want found.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://mattyspins.com';
  const now = new Date();

  // The 2026 routes. The retired paths (/wins, /clips, /shop, /giveaways,
  // /me, /giveaway-rules) redirect permanently and are deliberately absent —
  // listing a redirect in a sitemap only asks a crawler to follow it twice.
  const pages: Array<[string, MetadataRoute.Sitemap[number]['changeFrequency'], number]> = [
    ['', 'daily', 1],
    ['/leaderboard', 'hourly', 0.9],
    ['/milestones', 'daily', 0.8],
    ['/community', 'daily', 0.8],
    ['/raffles', 'daily', 0.7],
    ['/store', 'weekly', 0.7],
    ['/games', 'weekly', 0.7],
    ['/casinos', 'monthly', 0.6],
    ['/verify', 'monthly', 0.6],
    ['/official', 'monthly', 0.5],
    ['/terms', 'yearly', 0.3],
    ['/privacy', 'yearly', 0.3],
    ['/responsible', 'yearly', 0.4],
  ];

  return pages.map(([path, changeFrequency, priority]) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
