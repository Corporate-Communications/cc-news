import type { SourceConfig } from "./types.js";
import { aftenposten } from "./aftenposten.js";
import { aftenpostenPodcast } from "./aftenposten-podcast.js";
import { nrk } from "./nrk.js";
import { nrkPodcast } from "./nrk-podcast.js";

import { tradewinds } from "./tradewinds.js";

/** Alle registrerte kilder. Legg til nye her. */
export const SOURCES: SourceConfig[] = [
  aftenposten,
  aftenpostenPodcast,
  nrk,
  nrkPodcast,
  tradewinds,
];

export function getSource(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function enabledSources(): SourceConfig[] {
  return SOURCES.filter((s) => s.enabled);
}
