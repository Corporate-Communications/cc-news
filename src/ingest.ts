/**
 * Orkestrator: kjor ingest for en kilde eller alle.
 *
 *   npm run ingest                        # alle aktiverte kilder
 *   npm run ingest nrk                    # bare NRK artikler
 *   npm run ingest nrk 5                  # NRK, 5 artikler
 *   npm run ingest nrk-podcast            # NRK podkast, 5 per slug
 *   npm run ingest nrk-podcast 10         # 10 episoder per slug
 *   npm run ingest nrk-podcast politisk_kvarter 3  # ett program, 3 episoder
 *   npm run ingest aftenposten-podcast 100168 10   # ett AP-program
 *   npm run ingest nrk-podcast 2026-06-01 # alle episoder t.o.m. dato
 *
 * Artikler: discover -> hent fulltekst -> lagre.
 * Podkast: hent episoder + evt. VTT-transkript -> lagre.
 */
import { chromium, type BrowserContext } from "playwright";
import { discover } from "./discovery.js";
import { fetchArticle } from "./article.js";
import { storeArticle } from "./store.js";
import { resolveSessionPathForSource } from "./auth/resolve.js";
import { enabledSources, getSource } from "./sources/registry.js";
import {
  isArticleSource,
  isPodcastSource,
  type ArticleSourceConfig,
  type SourceConfig,
} from "./sources/types.js";
import { ingestPodcastSource } from "./fetchers/podcast.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_ARTICLE_LIMIT = 10;
const DEFAULT_PODCAST_LIMIT = 5;

async function ingestArticles(source: ArticleSourceConfig, limit: number) {
  const storageState = resolveSessionPathForSource(source);
  if (source.auth !== "none" && !storageState) {
    console.error(
      `  ⨯ Mangler sessions/${source.auth}.json. Kjor 'npm run login ${source.auth}'. Hopper over.`,
    );
    return;
  }

  console.log("  Discovery …");
  const found = (await discover(source)).slice(0, limit);
  console.log(`  ${found.length} artikler a hente.`);

  const browser = await chromium.launch({ headless: true });
  const ctx: BrowserContext = await browser.newContext(
    storageState ? { storageState } : {},
  );

  let created = 0,
    updated = 0,
    failed = 0;

  for (const [i, art] of found.entries()) {
    process.stdout.write(`  [${i + 1}/${found.length}] ${art.title ?? art.url}\n`);
    try {
      const result = await fetchArticle(ctx, art.url, {
        paywallMinChars: source.paywallMinChars,
      });
      const { created: isNew } = await storeArticle(
        source.id,
        art,
        result,
        Date.now(),
      );
      isNew ? created++ : updated++;
      const flag = result.looksPaywalled ? "⚠ avkortet" : "✓ full";
      console.log(
        `      ${isNew ? "ny" : "oppdatert"} — ${flag}, ${result.bodyChars} tegn (${result.source})`,
      );
    } catch (err) {
      failed++;
      console.log(`      ✗ feil: ${(err as Error).message}`);
    }
    await sleep(source.pauseMs);
  }

  await browser.close();
  console.log(`  → ${created} nye, ${updated} oppdatert, ${failed} feilet.`);
}

async function ingestSource(
  source: SourceConfig,
  limit: number,
  subTarget?: string,
  sinceIso?: string,
) {
  console.log(`\n=== ${source.name} (${source.id}) ===`);

  if (isArticleSource(source)) {
    await ingestArticles(source, limit);
  } else if (isPodcastSource(source)) {
    await ingestPodcastSource(source, { limit, subTarget, sinceIso });
  }
}

function parseArgs(argv: string[]): {
  target: string;
  limit: number;
  subTarget?: string;
  sinceIso?: string;
} {
  const target = argv[2] ?? "all";
  const arg3 = argv[3];
  const arg4 = argv[4];

  const isDate = arg3 && /^\d{4}-\d{2}-\d{2}$/.test(arg3);
  if (isDate) {
    return {
      target,
      limit: 500,
      sinceIso: `${arg3}T00:00:00.000Z`,
    };
  }

  // ap-svp / nrk-psapi: arg3=subTarget, arg4=limit
  const source = target !== "all" ? getSource(target) : undefined;
  if (source && isPodcastSource(source) && arg3 && !/^\d+$/.test(arg3)) {
    return {
      target,
      limit: Number(arg4 ?? DEFAULT_PODCAST_LIMIT),
      subTarget: arg3,
    };
  }

  const limit = Number(arg3 ?? (source?.contentType === "podcast" ? DEFAULT_PODCAST_LIMIT : DEFAULT_ARTICLE_LIMIT));
  return { target, limit, subTarget: arg4 };
}

async function main() {
  const { target, limit, subTarget, sinceIso } = parseArgs(process.argv);

  const sources =
    target === "all"
      ? enabledSources()
      : [getSource(target)].filter(
          Boolean as unknown as (s: SourceConfig | undefined) => s is SourceConfig,
        );

  if (sources.length === 0) {
    console.error(`Ukjent kilde "${target}". Kjent: npm run sources`);
    process.exit(1);
  }

  if (sinceIso) console.log(`Henter innhold t.o.m. ${process.argv[3]}.\n`);

  for (const source of sources) {
    await ingestSource(source, limit, subTarget, sinceIso);
  }
  console.log("\nFerdig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
