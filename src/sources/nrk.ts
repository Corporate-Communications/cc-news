import type { ArticleSourceConfig } from "./types.js";

export const nrk: ArticleSourceConfig = {
  id: "nrk",
  name: "NRK",
  contentType: "article",
  enabled: true,
  auth: "none", // apen, ingen innlogging
  discovery: {
    strategy: "sitemap-index",
    sitemapUrl: "https://www.nrk.no/sitemap.xml",
    maxAgeHours: 48,
    maxChildSitemaps: 8, // hent de nyest endrede under-sitemapene
    articleUrlPattern: "1\\.\\d+$", // NRK artikkel-id, f.eks. ...-1.12995743
  },
  pauseMs: 1_500,
  paywallMinChars: 400,
  schedule: { everyMinutes: 20, note: "apen kilde, sitemap-indeks" },
};
