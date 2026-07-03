# cc-news

Intern mediovervaking. Oppdager nye artikler og podkast-episoder, henter
innhold + metadata, og lagrer i Convex. Kilder er plugbare moduler — nye
kilder legges til med en liten config-fil.

> ⚠️ Automatisert tilgang med en konto bak betalingsmur kan vaere i strid med
> abonnementsvilkarene. Avklar med avtaleeier for produksjonsbruk. NRK er åpen.

## Oppsett
```bash
npm install
npx playwright install chromium
npx convex dev --once    # deployer schema + funksjoner (krever .env.local)
```

## Bruk
```bash
npm run sources                        # list konfigurerte kilder + status
npm run login schibsted                # Schibsted (Aftenposten, VG, BT, …)
npm run login dn-media                 # DN Media Group (TradeWinds, DN, …)
npm run login tradewinds               # alias → dn-media

# Artikler
npm run ingest                         # alle aktiverte kilder
npm run ingest nrk                     # bare NRK artikler
npm run ingest nrk 5                   # NRK, 5 artikler
npm run ingest aftenposten 20
npm run ingest tradewinds 10           # TradeWinds (krever dn-media login)

# Podkast (samme kommando — kilder er ikke skilt ut)
npm run ingest aftenposten-podcast              # alle AP-programmer, 5 episoder hver
npm run ingest aftenposten-podcast 100168       # ett program (Aftenpodden)
npm run ingest aftenposten-podcast 100168 10    # 10 nyeste episoder
npm run ingest nrk-podcast                      # alle konfigurerte NRK-slugs
npm run ingest nrk-podcast politisk_kvarter 5   # ett NRK-program, 5 episoder
npm run ingest nrk-podcast 2026-06-01           # alle episoder t.o.m. dato
```

`npm run podcast` er en snarvei til `ingest aftenposten-podcast` (bakoverkompatibel).

### Hentemetoder per kilde

| Kilde | Type | Metode |
|-------|------|--------|
| `aftenposten` | artikkel | news-sitemap + Playwright |
| `nrk` | artikkel | sitemap-index |
| `aftenposten-podcast` | podkast | AP programsider + SVP + VTT |
| `tradewinds` | artikkel | news-sitemap (dn-media auth) |

**Aftenposten podkast** (ingen login nodvendig):
1. Program-id-er fra /podkast → programsiden har episodeliste i HTML
2. SVP asset-API → tittel, varighet, stream-URL
3. Strip acast-prefiks → direkte dd-abo mp3 (full episode)
4. Utled `…/generated/_nb_NO.vtt` for ferdig transkript

**NRK podkast** (ingen login, basert pa `ref/nrk-tekst`):
1. `psapi.nrk.no/radio/catalog/podcast/<slug>/episodes` → metadata
2. `psapi.nrk.no/playback/manifest/podcast/<episodeId>` → MP3-URL
3. Ingen ferdig transkript — `textStatus: pending` til transkribering

| `nrk-podcast` | podkast | NRK PSAPI (katalog + playback-manifest) |
| `rss` (egen config) | podkast | RSS/Atom enclosure |

### Innlogging (auth-grupper)

Betalingsmur-kilder deler sesjon per mediekonsern — ikke per publikasjon:

| Gruppe | `npm run login` | Sesjonsfil | Publikasjoner |
|--------|-----------------|------------|---------------|
| Schibsted | `schibsted` | `sessions/schibsted.json` | aftenposten (+ VG, BT senere) |
| DN Media Group | `dn-media` | `sessions/dn-media.json` | tradewinds (+ DN senere) |

Du kan ogsa bruke kilde-id som alias (`login aftenposten` → schibsted).
Eldre `sessions/aftenposten.json` fungerer fortsatt som fallback for Schibsted.

Teasere/klipp filtreres via `minDurationSec` i kilde-config.

Verktoy: `npm run inspect:audio "<url>" [sesjonsfil]` — nettverks-inspektor.

Inspeksjon (alt ligger i én `items`-tabell med `type`-felt):
```bash
npx convex run items:recent '{"limit":10}'                 # alt
npx convex run items:recent '{"limit":10,"source":"nrk"}'  # per kilde
npx convex run items:recent '{"limit":10,"type":"podcast"}'# per type
npx convex run items:pending '{"limit":10}'                # mangler text (uten VTT)
npx convex run items:clearAll '{}'                         # tom tabellen (testing)
```

### Datamodell
Felles `items`-tabell. `type` = `article` | `podcast`. `text` holder selve
innholdet (artikkel-body eller podkast-transkript), `textStatus` = `done` |
`pending`. Felles felter: `source, type, url, title, publishedAt, text, excerpt,
textChars, textStatus, fetchedAt`. Type-spesifikt (valgfritt): artikkel
(`looksPaywalled, extractSource`), podkast (`program, programTitle, series,
coverImageId, audioUrl, transcriptUrl, durationSec`).

## Legge til en ny kilde

### Artikkel
1. Lag `src/sources/<id>.ts` som eksporterer en `ArticleSourceConfig`.
2. Registrer den i `src/sources/registry.ts`.
3. Velg `discovery.strategy`: `news-sitemap` eller `sitemap-index`.
4. Sett `auth` (`none` / auth-gruppe-id), `pauseMs`, `paywallMinChars` og `schedule`.

### Podkast
1. Lag `src/sources/<id>.ts` som eksporterer en `PodcastSourceConfig`.
2. Velg `fetch.strategy`:
   - `ap-svp` — Aftenposten (program-id-er)
   - `nrk-psapi` — NRK (slugs fra radio.nrk.no)
   - `rss` — generisk RSS/Atom-feed
3. Registrer i `registry.ts`.

## Struktur
- `src/auth/` — auth-grupper (Schibsted, DN Media) og sesjons-oppslag
- `src/fetchers/` — hentelogikk per strategi (ap-svp, nrk-psapi, rss, vtt)
- `src/discovery.ts` — artikkel-discovery (sitemap)
- `src/article.ts` — fulltekst + metadata-uttrekk
- `src/ingest.ts` — orkestrator (en kilde eller alle)
- `convex/` — schema + mutations/queries

## Kjoreplan
Hver kilde har `schedule.everyMinutes` i config — ment for en ekstern planlegger
(cron / Azure timer) som kaller `ingest <id>`. Selve scriptet kjorer on-demand.

## Sikkerhet
`sessions/` inneholder innloggede sesjoner (cookies/tokens) — gitignored,
skal aldri committes.
# cc-news
