import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  agentRules: false,
  // Phone preview through ngrok. The dev server otherwise blocks that host.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app"],
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // OMR uploads and sheet images go browser → this site → API, so phones on the ngrok/site URL never
  // need to reach the API host (localhost on the dev Mac) or pass its CORS list.
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
    return api ? [{ source: "/omr-api/:path*", destination: `${api}/api/v1/:path*` }] : [];
  },
  experimental: {
    // Keep Next buffers small — OMR PDFs upload directly to the API, not through Next.
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
