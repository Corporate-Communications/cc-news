/**
 * Podkast-ingest: dispatcher pa kilde-config og henter episoder + transkript.
 */
import type { Episode, PodcastSourceConfig } from "../sources/types.js";
import { discoverProgramIds, fetchApEpisodes } from "./ap-svp.js";
import { fetchNrkEpisodes } from "./nrk-psapi.js";
import { fetchRssEpisodes } from "./rss.js";
import { fetchTranscript } from "./vtt.js";
import { storeEpisode } from "../store.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PodcastIngestOpts {
  limit?: number;
  sinceIso?: string;
  /** ap-svp: program-id, nrk-psapi: slug */
  subTarget?: string;
}

async function storeEpisodes(
  sourceId: string,
  episodes: Episode[],
): Promise<{ created: number; updated: number; withTranscript: number }> {
  let created = 0,
    updated = 0,
    withTranscript = 0;
  for (const ep of episodes) {
    let transcript: string | null = null;
    if (ep.transcriptUrl) {
      try {
        transcript = await fetchTranscript(ep.transcriptUrl);
      } catch {
        transcript = null;
      }
    }
    if (transcript) withTranscript++;
    const { created: isNew } = await storeEpisode(
      sourceId,
      ep,
      transcript,
      Date.now(),
    );
    isNew ? created++ : updated++;
  }
  return { created, updated, withTranscript };
}

async function ingestApProgram(
  source: PodcastSourceConfig,
  programId: string,
  opts: PodcastIngestOpts,
) {
  const minDur = source.fetch.minDurationSec ?? 120;
  const { programTitle, episodes } = await fetchApEpisodes(programId, {
    limit: opts.limit,
    sinceIso: opts.sinceIso,
    minDurationSec: minDur,
  });
  const stats = await storeEpisodes(source.id, episodes);
  console.log(
    `  ${programId} ${programTitle} — ${episodes.length} episoder (${stats.created} nye, ${stats.updated} oppdatert, ${stats.withTranscript} m/transkript)`,
  );
}

async function ingestNrkSlug(
  source: PodcastSourceConfig,
  slug: string,
  opts: PodcastIngestOpts,
) {
  const minDur = source.fetch.minDurationSec ?? 0;
  const { programTitle, episodes } = await fetchNrkEpisodes(slug, {
    limit: opts.limit,
    sinceIso: opts.sinceIso,
    minDurationSec: minDur,
  });
  const stats = await storeEpisodes(source.id, episodes);
  console.log(
    `  ${slug} ${programTitle} — ${episodes.length} episoder (${stats.created} nye, ${stats.updated} oppdatert)`,
  );
}

async function ingestRssFeed(
  source: PodcastSourceConfig,
  opts: PodcastIngestOpts,
) {
  if (source.fetch.strategy !== "rss") return;
  const minDur = source.fetch.minDurationSec ?? 0;
  const { programTitle, episodes } = await fetchRssEpisodes(
    source.fetch.feedUrl,
    { limit: opts.limit, sinceIso: opts.sinceIso, minDurationSec: minDur },
  );
  const stats = await storeEpisodes(source.id, episodes);
  console.log(
    `  ${programTitle} — ${episodes.length} episoder (${stats.created} nye, ${stats.updated} oppdatert)`,
  );
}

export async function ingestPodcastSource(
  source: PodcastSourceConfig,
  opts: PodcastIngestOpts = {},
) {
  const limit = opts.limit ?? 5;
  const fetchCfg = source.fetch;

  switch (fetchCfg.strategy) {
    case "ap-svp": {
      let programIds: string[];
      if (opts.subTarget) {
        programIds = [opts.subTarget];
      } else if (fetchCfg.programs === "all") {
        console.log("  Oppdager programmer fra /podkast …");
        programIds = await discoverProgramIds();
        console.log(`  ${programIds.length} programmer.`);
      } else {
        programIds = fetchCfg.programs;
      }
      for (const id of programIds) {
        try {
          await ingestApProgram(source, id, { ...opts, limit });
        } catch (err) {
          console.log(`  ${id} — ✗ ${(err as Error).message}`);
        }
        await sleep(source.pauseMs);
      }
      break;
    }
    case "nrk-psapi": {
      const slugs = opts.subTarget ? [opts.subTarget] : fetchCfg.slugs;
      for (const slug of slugs) {
        try {
          await ingestNrkSlug(source, slug, { ...opts, limit });
        } catch (err) {
          console.log(`  ${slug} — ✗ ${(err as Error).message}`);
        }
        await sleep(source.pauseMs);
      }
      break;
    }
    case "rss": {
      try {
        await ingestRssFeed(source, { ...opts, limit });
      } catch (err) {
        console.log(`  ✗ ${(err as Error).message}`);
      }
      break;
    }
  }
}
