import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Increase API route timeout to 30 minutes for long-running operations
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
    externalResolver: true,
  },
  // Increase serverless function timeout (Vercel specific)
  serverRuntimeConfig: {
    apiTimeout: 1800, // 30 minutes in seconds
  },
};

export default nextConfig;
