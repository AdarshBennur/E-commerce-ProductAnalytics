/** @type {import('next').NextConfig} */
const nextConfig = {
    // ── API proxy ──────────────────────────────────────────────────────────────
    // BACKEND_URL must be set in Vercel environment variables pointing to the
    // Render service, e.g. https://ecommerce-analytics-api.onrender.com
    // Falls back to localhost:8000 for local development.
    async rewrites() {
        const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
        ]
    },

    // Expose BACKEND_URL to server-side code at runtime on Vercel
    serverRuntimeConfig: {
        BACKEND_URL: process.env.BACKEND_URL ?? 'http://localhost:8000',
    },

    // ── Memory optimisations ───────────────────────────────────────────────────
    experimental: {
        cpus: 1,
        webpackMemoryOptimizations: true,
    },

    productionBrowserSourceMaps: false,
}

module.exports = nextConfig
