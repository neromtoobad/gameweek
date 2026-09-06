import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The share cards read the display font from disk at request time, so the file has to travel
  // with the serverless function rather than be left behind by tracing.
  outputFileTracingIncludes: {
    "/api/og/[id]": ["./app/fonts/**"],
    "/opengraph-image": ["./app/fonts/**"],
  },
  // Pin the workspace root. Without it Turbopack walks up past the repo and finds an unrelated
  // lockfile in the home directory.
  turbopack: { root: __dirname },
};

export default nextConfig;
