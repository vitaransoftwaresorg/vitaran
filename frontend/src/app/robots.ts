import type { MetadataRoute } from "next";

const siteUrl = (
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.viitaran.com"
).replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/school/", "/teacher/", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
