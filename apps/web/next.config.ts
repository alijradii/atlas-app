import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  experimental: { proxyClientMaxBodySize: "50mb" },
  distDir: process.env.SCHOOL_E2E === "1" ? ".next-e2e" : ".next",
  transpilePackages: ["@school2036/ui", "@school2036/api-client"],
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
