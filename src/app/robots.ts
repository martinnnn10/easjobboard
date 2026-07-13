import type { MetadataRoute } from "next";
import { getPublicBaseUrl } from "@/lib/env";

// Read env at request time so a runtime-configured public domain is honored.
export const dynamic = "force-dynamic";

/**
 * Allow public crawling of careers and job pages; keep the admin app, APIs, and
 * private candidate token pages out of the index. References the root sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getPublicBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/o/*/admin/", "/api/", "/screen/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
