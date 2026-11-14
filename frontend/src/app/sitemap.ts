import type { MetadataRoute } from "next";

const siteUrl = (
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.viitaran.com"
).replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["", "/contact", "/teachers-resources", "/answer-keys", "/results"];

  return paths.map((path) => ({
    url: `${siteUrl}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
