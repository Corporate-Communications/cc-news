import type { ArticleSourceConfig } from "./types.js";

export const aftenposten: ArticleSourceConfig = {
  id: "aftenposten",
  name: "Aftenposten",
  contentType: "article",
  enabled: true,
  auth: "schibsted",
  discovery: {
    strategy: "news-sitemap",
    sitemapUrl: "https://www.aftenposten.no/sitemaps/files/articles-48hrs.xml",
  },
  pauseMs: 2_000,
  paywallMinChars: 400,
  schedule: { everyMinutes: 30, note: "48t news-sitemap, oppdateres ofte" },
};
