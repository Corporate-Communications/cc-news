import type { ArticleSourceConfig } from "./types.js";

export const tradewinds: ArticleSourceConfig = {
  id: "tradewinds",
  name: "TradeWinds",
  contentType: "article",
  enabled: true,
  auth: "dn-media",
  discovery: {
    strategy: "news-sitemap",
    sitemapUrl: "https://www.tradewindsnews.com/sitemap/news.xml",
  },
  pauseMs: 2_000,
  paywallMinChars: 400,
  schedule: { everyMinutes: 30, note: "news-sitemap, engelsk shipping" },
};
