import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes is deliberately off. It cannot see through an `href` passed as a
  // prop, which every reusable link-rendering component does, and it cannot check
  // a route assembled at runtime. tests/unit/routes-exist.test.ts asserts that
  // every configured destination resolves to a real page file, which covers both.
  experimental: {
    // A CV upload arrives as a server action's FormData. Next's default limit is
    // 1 MB and rejects the request inside the runtime, before the action body —
    // and so before its own size check — ever runs, which means the form gets
    // nothing to show and the upload fails in silence. A two-page PDF with a
    // photo clears 1 MB easily. This must stay at or above MAX_RESUME_BYTES;
    // tests/unit/upload-limits.test.ts fails if the two drift apart.
    serverActions: { bodySizeLimit: '10mb' },
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
}

export default nextConfig
