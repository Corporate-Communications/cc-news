/**
 * Aftenposten-podkast via programsider + SVP (Schibsted Video Platform).
 * RSS mangler fulle premium-episoder, sa vi bruker programsidens episodeliste.
 */
import type { Episode } from "../sources/types.js";

const LIST_URL = "https://www.aftenposten.no/podkast";
const PROGRAM_URL = (id: string) =>
  `https://www.aftenposten.no/podkast/ap/program/${id}`;
const SVP_ASSET = (id: number) =>
  `https://svp.vg.no/svp/api/v1/ap/assets/${id}?appName=svp-player`;
const UA = { "user-agent": "cc-news/0.1 (intern mediovervaking)" };

const AFTENPODDEN_ID = "100168";
const EKSTRA_LARS_ID = "100226";
const POLITIKERNE_COVER = "c139d1de4abdc1194e304ad8f3195b73";

export async function discoverProgramIds(): Promise<string[]> {
  const res = await fetch(LIST_URL, { headers: UA });
  if (!res.ok) throw new Error(`${LIST_URL} ga HTTP ${res.status}`);
  const html = await res.text();
  const ids = new Set<string>();
  for (const m of html.matchAll(/\/podkast\/ap\/program\/(\d+)/g)) ids.add(m[1]);
  return [...ids];
}

async function episodeAssetIds(programId: string): Promise<number[]> {
  const res = await fetch(PROGRAM_URL(programId), { headers: UA });
  if (!res.ok) throw new Error(`program ${programId} ga HTTP ${res.status}`);
  const html = await res.text();
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const m of html.matchAll(/"type":"podcast-episode","id":(\d+)/g)) {
    const id = Number(m[1]);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

async function episodeTitleSet(programId: string): Promise<Set<string>> {
  const titles = new Set<string>();
  try {
    const res = await fetch(PROGRAM_URL(programId), { headers: UA });
    if (!res.ok) return titles;
    const html = await res.text();
    for (const m of html.matchAll(
      /"type":"podcast-episode","id":\d+,"provider":"ap","title":"([^"]*)"/g,
    )) {
      titles.add(m[1].trim());
    }
  } catch {
    /* tom */
  }
  return titles;
}

function classifySeries(
  programId: string,
  programTitle: string,
  title: string,
  coverImageId: string | undefined,
  ekstraLarsTitles: Set<string>,
): string {
  if (programId === AFTENPODDEN_ID) {
    if (ekstraLarsTitles.has(title.trim())) return "Ekstra Lars";
    if (coverImageId === POLITIKERNE_COVER) return "Aftenpodden Politikerne";
    return "Aftenpodden";
  }
  return programTitle;
}

interface SvpAsset {
  id: number;
  title?: string;
  description?: string;
  duration?: number;
  published?: number;
  category?: { id?: number; title?: string };
  streamUrls?: { mp4?: string | null; hls?: string | null };
  images?: { main?: string };
}

function coverImageId(asset: SvpAsset): string | undefined {
  const m = (asset.images?.main ?? "").match(/images\/([a-f0-9]+)\./i);
  return m ? m[1] : undefined;
}

async function fetchAsset(id: number): Promise<SvpAsset | null> {
  const res = await fetch(SVP_ASSET(id), { headers: UA });
  if (!res.ok) return null;
  return (await res.json()) as SvpAsset;
}

function toDirectAudioUrl(mp3: string): string {
  const stripped = mp3.replace(
    /^https?:\/\/flex2\.acast\.com\/s\/[^/]+\/u\//i,
    "",
  );
  if (stripped === mp3) return mp3;
  return /^https?:\/\//.test(stripped) ? stripped : `https://${stripped}`;
}

function toTranscriptUrl(audioUrl: string): string | undefined {
  const m = audioUrl.match(
    /^(https:\/\/dd-abo\.akamaized\.net\/.*\/)podcast_\d+\.mp3/i,
  );
  return m ? `${m[1]}generated/_nb_NO.vtt` : undefined;
}

function toIso(published?: number): string | undefined {
  if (!published) return undefined;
  const ms = published < 1e12 ? published * 1000 : published;
  return new Date(ms).toISOString();
}

function stripHtml(s: string, max = 600): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function fetchApEpisodes(
  programId: string,
  opts: { limit?: number; minDurationSec?: number; sinceIso?: string } = {},
): Promise<{ programTitle: string; episodes: Episode[] }> {
  const limit = opts.limit ?? (opts.sinceIso ? 500 : 10);
  const minDur = opts.minDurationSec ?? 0;
  const ids = await episodeAssetIds(programId);
  const ekstraLarsTitles =
    programId === AFTENPODDEN_ID
      ? await episodeTitleSet(EKSTRA_LARS_ID)
      : new Set<string>();

  let programTitle = programId;
  const episodes: Episode[] = [];
  for (const id of ids) {
    if (episodes.length >= limit) break;
    const asset = await fetchAsset(id);
    if (!asset) continue;
    if (asset.category?.title) programTitle = asset.category.title;

    const publishedAt = toIso(asset.published);
    if (opts.sinceIso && publishedAt && publishedAt < opts.sinceIso) break;

    const mp3 = asset.streamUrls?.mp4;
    if (!mp3) continue;
    const durationSec = asset.duration ? Math.round(asset.duration / 1000) : 0;
    if (durationSec < minDur) continue;

    const audioUrl = toDirectAudioUrl(mp3);
    const title = asset.title?.trim() || "(uten tittel)";
    const cover = coverImageId(asset);
    const ptitle = asset.category?.title ?? programId;
    episodes.push({
      program: programId,
      programTitle: ptitle,
      series: classifySeries(programId, ptitle, title, cover, ekstraLarsTitles),
      coverImageId: cover,
      url: `https://www.aftenposten.no/podkast/ap/episode/${asset.id}`,
      title,
      publishedAt,
      audioUrl,
      transcriptUrl: toTranscriptUrl(audioUrl),
      durationSec,
      description: asset.description ? stripHtml(asset.description) : undefined,
    });
  }
  return { programTitle, episodes };
}
