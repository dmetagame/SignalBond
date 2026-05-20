import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
