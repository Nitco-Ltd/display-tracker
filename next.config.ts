import type { NextConfig } from "next";

// Internal, always-live dashboard: every page reads the database on each request, so no component caching.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
