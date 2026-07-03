import type { PodcastSourceConfig } from "./types.js";

/**
 * Eksempel pa RSS-basert podkast-kilde. Sett enabled: true og oppdater feedUrl.
 * Legg til i registry.ts nar den skal brukes.
 */
export const exampleRssPodcast: PodcastSourceConfig = {
  id: "example-rss",
  name: "Eksempel RSS-podkast",
  contentType: "podcast",
  enabled: false,
  fetch: {
    strategy: "rss",
    feedUrl: "https://example.com/podcast/feed.xml",
    minDurationSec: 60,
  },
  pauseMs: 1_000,
};
