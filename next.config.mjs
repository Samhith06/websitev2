/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two lockfiles exist above this folder; pin the root so tracing is correct.
  outputFileTracingRoot: import.meta.dirname,
  // `pg` loads native and optional modules by name; bundling it breaks that.
  serverExternalPackages: ['pg'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.kick.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '**.cloudflarestream.com' },
    ],
  },
  /**
   * The 2026 revamp renamed four sections. These are permanent because the old
   * paths have been shared in Discord and printed on stream overlays for
   * months — a 404 on a link someone pinned last year is a worse outcome than
   * carrying six redirect rules forever.
   */
  async redirects() {
    return [
      { source: '/giveaways', destination: '/raffles', permanent: true },
      { source: '/giveaway-rules', destination: '/raffles', permanent: true },
      { source: '/shop', destination: '/store', permanent: true },
      { source: '/me', destination: '/profile', permanent: true },
      { source: '/clips', destination: '/community', permanent: true },
      { source: '/wins', destination: '/community?view=fame', permanent: true },
    ];
  },
};
export default nextConfig;
