import type { PodcastSourceConfig } from "./types.js";

/** NRK podkast via PSAPI. Slugs fra radio.nrk.no/podkast/<slug>. */
export const nrkPodcast: PodcastSourceConfig = {
  id: "nrk-podcast",
  name: "NRK podkast",
  contentType: "podcast",
  enabled: true,
  fetch: {
    strategy: "nrk-psapi",
    slugs: [
      "politisk_kvarter",
      "dagsnytt_18",
      "oppdatert",
      "forklart",
      "abels_taarn",
    ],
    minDurationSec: 60,
  },
  pauseMs: 1_000,
  schedule: { everyMinutes: 30, note: "PSAPI katalog + playback-manifest" },
};
