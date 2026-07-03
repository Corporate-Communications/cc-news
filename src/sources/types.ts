/**
 * Felles typer for medie-kilder. En "kilde" er et medium med egen
 * hentemetode — artikler via sitemap, podkast via RSS/SVP/PSAPI osv.
 * Nye kilder legges til ved a droppe en ny fil i src/sources/ og
 * registrere den i registry.ts.
 */

import type { AuthGroupId } from "../auth/groups.js";

export type ContentType = "article" | "podcast";

// --- Artikler ---

export interface DiscoveredArticle {
  url: string;
  /** Kan mangle (f.eks. NRK-sitemap) — fylles da fra artikkelsiden. */
  title?: string;
  publishedAt?: string;
  lastmod?: string;
}

export type DiscoveryStrategy = "news-sitemap" | "sitemap-index";

export interface DiscoveryConfig {
  strategy: DiscoveryStrategy;
  sitemapUrl: string;
  /** sitemap-index: bare ta med artikler endret nyere enn dette. */
  maxAgeHours?: number;
  /** sitemap-index: maks antall under-sitemaps a hente (nyeste forst). */
  maxChildSitemaps?: number;
  /** Regex (kildestreng) som identifiserer en artikkel-URL. */
  articleUrlPattern?: string;
}

// --- Podkast ---

/** En podkast-episode med direkte lyd-URL + evt. ferdig transkript. */
export interface Episode {
  program: string;
  programTitle: string;
  /** Undertype / serie, f.eks. "Aftenpodden" eller "Politisk kvarter". */
  series: string;
  coverImageId?: string;
  /** Klikkbar episode-side. Dedup-nokkel. */
  url: string;
  title: string;
  publishedAt?: string;
  audioUrl: string;
  transcriptUrl?: string;
  audioBytes?: number;
  durationSec?: number;
  description?: string;
}

export type PodcastFetchStrategy =
  | {
      strategy: "ap-svp";
      /** "all" = oppdag fra /podkast, ellers liste av program-id-er. */
      programs: "all" | string[];
      minDurationSec?: number;
    }
  | {
      strategy: "nrk-psapi";
      /** Slugs fra radio.nrk.no/podkast/<slug>, f.eks. politisk_kvarter. */
      slugs: string[];
      minDurationSec?: number;
    }
  | {
      strategy: "rss";
      feedUrl: string;
      minDurationSec?: number;
    };

// --- Felles kilde-config ---

export interface ScheduleConfig {
  everyMinutes?: number;
  note?: string;
}

interface BaseSourceConfig {
  id: string;
  name: string;
  enabled: boolean;
  contentType: ContentType;
  pauseMs: number;
  schedule?: ScheduleConfig;
}

export interface ArticleSourceConfig extends BaseSourceConfig {
  contentType: "article";
  /** "none" = apen; ellers auth-gruppe (delt sesjon pa tvers av publikasjoner). */
  auth: "none" | AuthGroupId;
  discovery: DiscoveryConfig;
  paywallMinChars: number;
}

export interface PodcastSourceConfig extends BaseSourceConfig {
  contentType: "podcast";
  fetch: PodcastFetchStrategy;
}

export type SourceConfig = ArticleSourceConfig | PodcastSourceConfig;

export function isArticleSource(s: SourceConfig): s is ArticleSourceConfig {
  return s.contentType === "article";
}

export function isPodcastSource(s: SourceConfig): s is PodcastSourceConfig {
  return s.contentType === "podcast";
}
