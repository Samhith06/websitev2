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
};
export default nextConfig;
