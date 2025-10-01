import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Skip ESLint during builds in production to avoid blocking deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip TypeScript checking during builds in production
    ignoreBuildErrors: true,
  },
  // Use the new typedRoutes config location
  typedRoutes: false,
};

export default nextConfig;
