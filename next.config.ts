import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // native SQLite bindings must not be bundled
  serverExternalPackages: ["@libsql/client", "libsql"],
  // The floor writes ./data/lounge.db every few seconds — don't let that trigger dev recompiles.
  webpack: (config, { dev }) => {
    if (dev) config.watchOptions = { ...config.watchOptions, ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/data/**"] };
    return config;
  },
};

export default nextConfig;
