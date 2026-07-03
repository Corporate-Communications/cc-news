import type { PodcastSourceConfig } from "./types.js";

export const aftenpostenPodcast: PodcastSourceConfig = {
  id: "aftenposten-podcast",
  name: "Aftenposten podkast",
  contentType: "podcast",
  enabled: true,
  fetch: {
    strategy: "ap-svp",
    programs: "all",
    minDurationSec: 120, // dropp teasere/klipp
  },
  pauseMs: 500,
  schedule: { everyMinutes: 60, note: "SVP + VTT-transkript" },
};
