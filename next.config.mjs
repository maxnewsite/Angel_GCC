/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker/Cloud Run deployment

  // Moved from experimental in Next.js 16
  serverExternalPackages: ["@react-pdf/renderer"],

  // Next.js 16 uses Turbopack by default, add empty config to silence warning
  turbopack: {},

  // Keep webpack config for compatibility (only used in webpack mode)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
