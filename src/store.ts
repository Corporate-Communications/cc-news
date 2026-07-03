/**
 * Convex-klient for ingestion. Alt skrives til den felles `items`-tabellen med
 * et `type`-felt; `text` holder selve innholdet (body/transkript).
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import type { ArticleResult } from "./article.js";
import type { DiscoveredArticle, Episode } from "./sources/types.js";

const EXCERPT_CHARS = 500; // bundet utdrag for lister/varsler

// tsx auto-laster ikke .env.local; gjor det eksplisitt.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* .env.local mangler — vi sjekker CONVEX_URL under */
}

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error(
    "CONVEX_URL mangler. Kjor 'npx convex dev' for a generere .env.local.",
  );
}

const client = new ConvexHttpClient(CONVEX_URL);

export async function storeArticle(
  sourceId: string,
  discovered: DiscoveredArticle,
  article: ArticleResult,
  fetchedAt: number,
): Promise<{ created: boolean }> {
  const res = await client.mutation(api.items.upsert, {
    source: sourceId,
    type: "article",
    url: article.url,
    title: article.title || discovered.title || article.url,
    publishedAt: article.publishedAt ?? discovered.publishedAt,
    text: article.body,
    excerpt: article.body.slice(0, EXCERPT_CHARS),
    textChars: article.bodyChars,
    author: article.author,
    section: article.section,
    looksPaywalled: article.looksPaywalled,
    extractSource: article.source,
    fetchedAt,
  });
  return { created: res.created };
}

export async function storeEpisode(
  sourceId: string,
  ep: Episode,
  transcript: string | null,
  fetchedAt: number,
): Promise<{ created: boolean }> {
  const res = await client.mutation(api.items.upsert, {
    source: sourceId,
    type: "podcast",
    url: ep.url,
    title: ep.title,
    publishedAt: ep.publishedAt,
    text: transcript ?? undefined,
    excerpt: transcript ? transcript.slice(0, EXCERPT_CHARS) : undefined,
    textChars: transcript ? transcript.length : undefined,
    program: ep.program,
    programTitle: ep.programTitle,
    series: ep.series,
    coverImageId: ep.coverImageId,
    audioUrl: ep.audioUrl,
    transcriptUrl: ep.transcriptUrl,
    durationSec: ep.durationSec,
    audioBytes: ep.audioBytes,
    fetchedAt,
  });
  return { created: res.created };
}
