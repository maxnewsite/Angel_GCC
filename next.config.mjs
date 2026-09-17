import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the project root so a stray lockfile in a parent folder is never used
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker/Cloud Run deployment

  // pdfkit is a native Node.js module — keep it external so Turbopack
  // does not attempt to bundle it for the browser bundle.
  serverExternalPackages: ["pdfkit"],

  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },

  // Keep webpack config for compatibility (only used in webpack mode)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
