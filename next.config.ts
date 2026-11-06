import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // native SQLite bindings must not be bundled
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
