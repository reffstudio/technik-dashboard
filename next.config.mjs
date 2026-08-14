/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Next 16 usa Turbopack en `next build`. La config webpack de abajo es solo para `next dev --webpack`.
  turbopack: {},
  onDemandEntries: {
    maxInactiveAge: 15_000,
    pagesBufferLength: 2,
  },
  // En prod estos headers evitan cache agresivo del dashboard. En dev inflan Next.
  async headers() {
    if (process.env.NODE_ENV !== "production") return []
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ]
  },
}

if (process.env.NODE_ENV !== "production") {
  nextConfig.experimental = { webpackMemoryOptimizations: true }
  nextConfig.webpack = (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
        aggregateTimeout: 400,
      }
      config.cache = { type: "filesystem" }
    }
    return config
  }
}

export default nextConfig
