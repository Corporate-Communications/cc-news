/**
 * Generisk podkast-RSS/Atom-feed. Parser enclosure for lyd-URL.
 */
import { XMLParser } from "fast-xml-parser";
import type { Episode } from "../sources/types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});
const UA = { "user-agent": "cc-news/0.1 (intern mediovervaking)" };

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  // HH:MM:SS eller sekunder
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

function parsePubDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? raw : new Date(ms).toISOString();
}

function pickAudioUrl(item: Record<string, unknown>): string | undefined {
  const enclosure = item.enclosure as
    | { "@_url"?: string; "@_type"?: string }
    | { "@_url"?: string; "@_type"?: string }[]
    | undefined;
  const enclosures = asArray(enclosure);
  for (const enc of enclosures) {
    const type = (enc["@_type"] ?? "").toLowerCase();
    const url = enc["@_url"];
    if (url && (type.startsWith("audio/") || type === "")) return url;
  }
  // media:content fallback
  const media = item.content as
    | { "@_url"?: string; "@_type"?: string }
    | undefined;
  if (media?.["@_url"] && (media["@_type"] ?? "").startsWith("audio/")) {
    return media["@_url"];
  }
  return enclosures[0]?.["@_url"];
}

export async function fetchRssEpisodes(
  feedUrl: string,
  opts: { limit?: number; minDurationSec?: number; sinceIso?: string } = {},
): Promise<{ programTitle: string; episodes: Episode[] }> {
  const res = await fetch(feedUrl, { headers: UA });
  if (!res.ok) throw new Error(`RSS ${feedUrl} → HTTP ${res.status}`);
  const doc = parser.parse(await res.text());

  const channel = doc?.rss?.channel ?? doc?.feed;
  if (!channel) throw new Error("Ugyldig RSS/Atom-feed");

  const feedTitle = String(channel.title ?? new URL(feedUrl).hostname);
  const items = asArray<Record<string, unknown>>(channel.item ?? channel.entry);

  const limit = opts.limit ?? (opts.sinceIso ? 500 : 10);
  const minDur = opts.minDurationSec ?? 0;
  const episodes: Episode[] = [];

  for (const item of items) {
    const publishedAt = parsePubDate(
      String(item.pubDate ?? item.published ?? item.updated ?? ""),
    );
    if (opts.sinceIso && publishedAt && publishedAt < opts.sinceIso) break;

    const audioUrl = pickAudioUrl(item);
    if (!audioUrl) continue;

    const durationSec =
      parseDuration(String(item.duration ?? item["itunes:duration"] ?? "")) ??
      undefined;
    if (durationSec != null && durationSec < minDur) continue;

    const linkRaw = item.link;
    const link =
      typeof linkRaw === "object" && linkRaw !== null && "@_href" in linkRaw
        ? String((linkRaw as { "@_href"?: string })["@_href"] ?? "")
        : String(linkRaw ?? item.guid ?? "");
    const title = String(item.title ?? "(uten tittel)").trim();
    const url = link || audioUrl;

    episodes.push({
      program: feedTitle,
      programTitle: feedTitle,
      series: feedTitle,
      url,
      title,
      publishedAt,
      audioUrl,
      durationSec,
      description: item.description
        ? String(item.description).replace(/<[^>]+>/g, " ").trim().slice(0, 600)
        : undefined,
    });

    if (episodes.length >= limit) break;
  }

  return { programTitle: feedTitle, episodes };
}
