/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* to the NestJS backend so the browser only ever talks to Next,
  // and the Alpha Vantage key stays server-side. Override with BACKEND_URL.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
};

module.exports = nextConfig;
