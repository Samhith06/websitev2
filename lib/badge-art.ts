/**
 * Badge artwork, resolved from the slug.
 *
 * Not a database column, on purpose. The art is a static file that ships with
 * the build, so a path stored in a row could point at something that is not
 * there — and a badge rendering a broken image is worse than one rendering the
 * letter it used to. This list is the thing that guarantees the file exists,
 * because adding to it and adding the file are the same commit.
 *
 * A badge without art here falls back to the initial-letter tile, which is
 * what every badge looked like before the artwork arrived. That fallback is
 * the reason a new badge can be an insert rather than a deploy: it renders
 * plainly until somebody draws it.
 */

/** Slugs with a file in `public/brand/badges`. */
const WITH_ART = new Set([
  'high-roller',
  'vip',
  'whale',
  'champion',
  'podium',
  'founder',
  'verified',
  'grinder',
  'regular',
  'streak',
  'lucky',
  'collector',
  'sub',
  'poker-night',
]);

export function badgeArt(slug: string): string | null {
  return WITH_ART.has(slug) ? `/brand/badges/${slug}.svg` : null;
}
