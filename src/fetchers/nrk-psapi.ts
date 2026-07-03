/**
 * NRK podkast via offentlig PSAPI (psapi.nrk.no).
 * Katalog for metadata/episoder, playback-manifest for lyd-URL.
 */
import type { Episode } from "../sources/types.js";

const PSAPI = "https://psapi.nrk.no";
const UA = "cc-news/0.1 (intern mediovervaking)";

interface RawEpisode {
  episodeId?: string;
  titles?: { title?: string; subtitle?: string };
  date?: string;
  durationInSeconds?: number;
  _links?: { share?: { href?: string } };
  squareImage?: ImageEntry[];
  image?: ImageEntry[];
}

interface ImageEntry {
  url?: string;
  width?: number;
}

interface CatalogPage {
  _embedded?: { episodes?: RawEpisode[] };
  _links?: { next?: unknown };
}

interface PlaybackManifest {
  playability?: string | null;
  playable?: { assets?: { url?: string; format?: string }[] };
}

function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_-]/g, "");
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${PSAPI}${path}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`PSAPI ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

function bestImageUrl(images: ImageEntry[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  let best: string | undefined;
  let bestW = -1;
  for (const im of images) {
    const w = Number(im.width ?? 0);
    if (im.url && w >= bestW) {
      bestW = w;
      best = im.url;
    }
  }
  return best;
}

async function resolveAudioUrl(episodeId: string): Promise<string> {
  let manifest: PlaybackManifest;
  try {
    manifest = await fetchJson(`/playback/manifest/podcast/${episodeId}`);
  } catch {
    manifest = await fetchJson(`/playback/manifest/program/${episodeId}`);
  }
  const play = manifest.playability;
  if (play != null && play !== "playable") {
    throw new Error(`Ikke avspillbar: playability=${play}`);
  }
  const assets = manifest.playable?.assets ?? [];
  const mp3 = assets.find((a) => a.format?.toUpperCase() === "MP3" && a.url);
  if (mp3?.url) return mp3.url;
  const any = assets.find((a) => a.url);
  if (any?.url) return any.url;
  throw new Error("Fant ingen lyd-URL i manifest");
}

async function fetchCatalogPage(
  slug: string,
  page: number,
  pageSize: number,
): Promise<{ episodes: RawEpisode[]; hasNext: boolean }> {
  const data = await fetchJson<CatalogPage>(
    `/radio/catalog/podcast/${slug}/episodes?pageSize=${pageSize}&page=${page}&sort=desc`,
  );
  return {
    episodes: data._embedded?.episodes ?? [],
    hasNext: data._links?.next != null,
  };
}

export async function fetchPodcastMeta(slug: string): Promise<{
  title: string;
  subtitle?: string;
}> {
  const data = await fetchJson<{
    series?: { titles?: { title?: string; subtitle?: string } };
    titles?: { title?: string; subtitle?: string };
  }>(`/radio/catalog/podcast/${sanitizeSlug(slug)}`);
  const titles = data.series?.titles ?? data.titles ?? {};
  return {
    title: titles.title ?? slug,
    subtitle: titles.subtitle,
  };
}

function rawToEpisode(
  slug: string,
  programTitle: string,
  ep: RawEpisode,
  audioUrl: string,
): Episode | null {
  const episodeId = ep.episodeId;
  if (!episodeId) return null;
  const titles = ep.titles ?? {};
  const title = titles.title?.trim() || "(uten tittel)";
  const url =
    ep._links?.share?.href ??
    `https://radio.nrk.no/podkast/${slug}/siste/${episodeId}`;
  return {
    program: slug,
    programTitle,
    series: programTitle,
    coverImageId: bestImageUrl(ep.squareImage ?? ep.image),
    url,
    title,
    publishedAt: ep.date,
    audioUrl,
    durationSec: ep.durationInSeconds
      ? Number(ep.durationInSeconds)
      : undefined,
    description: titles.subtitle,
  };
}

export async function fetchNrkEpisodes(
  slug: string,
  opts: { limit?: number; minDurationSec?: number; sinceIso?: string } = {},
): Promise<{ programTitle: string; episodes: Episode[] }> {
  const clean = sanitizeSlug(slug);
  if (!clean) throw new Error(`Ugyldig slug: ${slug}`);

  const limit = opts.limit ?? (opts.sinceIso ? 500 : 10);
  const minDur = opts.minDurationSec ?? 0;
  const meta = await fetchPodcastMeta(clean);
  const programTitle = meta.title;

  const episodes: Episode[] = [];
  let page = 1;
  const pageSize = Math.min(50, limit);

  while (episodes.length < limit) {
    let pageData: { episodes: RawEpisode[]; hasNext: boolean };
    try {
      pageData = await fetchCatalogPage(clean, page, pageSize);
    } catch (err) {
      if (page === 1) throw err;
      break;
    }

    for (const raw of pageData.episodes) {
      if (opts.sinceIso && raw.date && raw.date < opts.sinceIso) {
        return { programTitle, episodes };
      }
      const dur = raw.durationInSeconds ? Number(raw.durationInSeconds) : 0;
      if (dur > 0 && dur < minDur) continue;

      const episodeId = raw.episodeId;
      if (!episodeId) continue;

      try {
        const audioUrl = await resolveAudioUrl(episodeId);
        const ep = rawToEpisode(clean, programTitle, raw, audioUrl);
        if (ep) {
          episodes.push(ep);
          if (episodes.length >= limit) return { programTitle, episodes };
        }
      } catch {
        /* hopp over episoder uten lyd */
      }
    }

    if (!pageData.hasNext) break;
    page++;
  }

  return { programTitle, episodes };
}
