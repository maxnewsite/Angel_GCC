/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker/Cloud Run deployment

  // pdfkit is a native Node.js module — keep it external so Turbopack
  // does not attempt to bundle it for the browser bundle.
  serverExternalPackages: ["pdfkit"],

  // Next.js 16 uses Turbopack by default, add empty config to silence warning
  turbopack: {},

  // Keep webpack config for compatibility (only used in webpack mode)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
