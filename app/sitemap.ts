import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/clubs/gsm-padel`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/clubs/gsm-padel/overview`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/rules`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Dynamic tenant URLs may be added only for published clubs.
  ];
}
