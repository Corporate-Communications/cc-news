/**
 * Discovery: finn nye artikler for en kilde. Dispatcher pa strategi.
 *   - news-sitemap : enkelt urlset med Google News-tagger (Aftenposten)
 *   - sitemap-index: indeks -> nyeste under-sitemaps -> filtrer pa lastmod (NRK)
 */
import { XMLParser } from "fast-xml-parser";
import type { ArticleSourceConfig, DiscoveredArticle } from "./sources/types.js";

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

const UA = { "user-agent": "cc-news/0.1 (intern mediovervaking)" };

async function fetchXml(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} ga HTTP ${res.status}`);
  return parser.parse(await res.text());
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

/** Aftenposten-stil: ett urlset med <news:title> + <news:publication_date>. */
async function discoverNewsSitemap(
  cfg: ArticleSourceConfig,
): Promise<DiscoveredArticle[]> {
  const doc = await fetchXml(cfg.discovery.sitemapUrl);
  return asArray<any>(doc?.urlset?.url).map((e) => {
    const news = e.news?.news ?? e.news;
    return {
      url: String(e.loc),
      title: news?.title ? String(news.title).trim() : undefined,
      publishedAt: news?.publication_date
        ? String(news.publication_date)
        : undefined,
      lastmod: e.lastmod ? String(e.lastmod) : undefined,
    };
  });
}

/** NRK-stil: sitemapindex -> hent nyeste under-sitemaps -> filtrer pa lastmod. */
async function discoverSitemapIndex(
  cfg: ArticleSourceConfig,
): Promise<DiscoveredArticle[]> {
  const maxAgeHours = cfg.discovery.maxAgeHours ?? 48;
  const maxChildren = cfg.discovery.maxChildSitemaps ?? 8;
  const pattern = cfg.discovery.articleUrlPattern
    ? new RegExp(cfg.discovery.articleUrlPattern)
    : undefined;
  const cutoff = Date.now() - maxAgeHours * 3_600_000;

  const index = await fetchXml(cfg.discovery.sitemapUrl);
  const children = asArray<any>(index?.sitemapindex?.sitemap)
    .map((s) => ({
      loc: String(s.loc),
      lastmodMs: s.lastmod ? Date.parse(String(s.lastmod)) : 0,
    }))
    .sort((a, b) => b.lastmodMs - a.lastmodMs)
    .slice(0, maxChildren);

  const articles: DiscoveredArticle[] = [];
  for (const child of children) {
    let doc: any;
    try {
      doc = await fetchXml(child.loc);
    } catch {
      continue; // hopp over en under-sitemap som feiler
    }
    for (const e of asArray<any>(doc?.urlset?.url)) {
      const url = String(e.loc);
      if (pattern && !pattern.test(url)) continue;
      const lastmodMs = e.lastmod ? Date.parse(String(e.lastmod)) : 0;
      if (lastmodMs < cutoff) continue;
      articles.push({
        url,
        lastmod: e.lastmod ? String(e.lastmod) : undefined,
        publishedAt: e.lastmod ? String(e.lastmod) : undefined,
      });
    }
  }
  // nyeste forst
  return articles.sort(
    (a, b) => Date.parse(b.lastmod ?? "") - Date.parse(a.lastmod ?? ""),
  );
}

export async function discover(
  cfg: ArticleSourceConfig,
): Promise<DiscoveredArticle[]> {
  switch (cfg.discovery.strategy) {
    case "news-sitemap":
      return discoverNewsSitemap(cfg);
    case "sitemap-index":
      return discoverSitemapIndex(cfg);
  }
}
