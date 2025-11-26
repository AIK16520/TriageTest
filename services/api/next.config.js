/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable X-Powered-By header for security
  poweredByHeader: false,
  // API routes configuration
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
