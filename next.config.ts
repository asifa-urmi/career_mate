import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes is deliberately off. It cannot see through an `href` passed as a
  // prop, which every reusable link-rendering component does, and it cannot check
  // a route assembled at runtime. tests/unit/routes-exist.test.ts asserts that
  // every configured destination resolves to a real page file, which covers both.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
}

export default nextConfig
