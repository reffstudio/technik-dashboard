/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackMemoryOptimizations: true,
  },
  onDemandEntries: {
    maxInactiveAge: 15_000,
    pagesBufferLength: 2,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
        aggregateTimeout: 400,
      }
      config.cache = { type: "filesystem" }
    }
    return config
  },
  // En dev estos headers obligan a recargar todo en cada request y inflan Next.
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

export default nextConfig
