/**
 * Generell lyd-/API-inspektor. Avslorer hvordan en innlogget side leverer lyd,
 * slik at vi kan bygge henteren pa fakta.
 *
 *   npm run inspect:audio "<url>"                  # bruker aftenposten-sesjon
 *   npm run inspect:audio "<url>" sessions/podme.json
 *
 * Aapner siden i innlogget browser, starter avspilling, og logger alle
 * XHR/fetch/media-requests + lyd-/stream-URL-er med status, content-type og om
 * Authorization-header er satt. Dumper til out/inspect-audio.json.
 */
import { chromium, type Request } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolveSessionPath } from "../auth/resolve.js";

const AUDIO_RE = /\.(mp3|m4a|aac|m3u8|ts)(\?|$)/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Hit {
  resourceType: string;
  method: string;
  url: string;
  status?: number;
  hasAuth: boolean;
  contentType?: string;
  isAudio: boolean;
}

async function main() {
  const url = process.argv[2];
  const session =
    process.argv[3] ?? resolveSessionPath("schibsted") ?? "sessions/schibsted.json";
  if (!url) {
    console.error('Bruk: npm run inspect:audio "<url>" [sesjonsfil]');
    process.exit(1);
  }
  if (!existsSync(session)) {
    console.error(
      `Mangler sesjon ${session}. Logg inn forst (npm run login schibsted).`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: session });
  const page = await ctx.newPage();

  const hits = new Map<string, Hit>();
  const consider = (req: Request) => {
    const rt = req.resourceType();
    const isAudio = AUDIO_RE.test(req.url());
    if (!isAudio && rt !== "xhr" && rt !== "fetch" && rt !== "media") return;
    hits.set(req.url(), {
      resourceType: rt,
      method: req.method(),
      url: req.url(),
      hasAuth: Boolean(req.headers()["authorization"]),
      contentType: req.headers()["content-type"],
      isAudio,
    });
  };

  page.on("request", consider);
  page.on("response", (res) => {
    const h = hits.get(res.url());
    if (h) {
      h.status = res.status();
      h.contentType = res.headers()["content-type"] ?? h.contentType;
    }
  });

  console.log(`Aapner ${url} (sesjon: ${session}) …`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await sleep(3_000);

  for (const sel of [
    'button[aria-label*="spill" i]',
    'button[aria-label*="play" i]',
    'button[title*="spill" i]',
    '[data-testid*="play" i]',
    'button:has-text("Spill")',
  ]) {
    const btn = page.locator(sel).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 2_000 }).catch(() => {});
      console.log(`  klikket: ${sel}`);
      break;
    }
  }
  console.log("  fanger trafikk i 25s (start avspilling manuelt om nodvendig) …");
  await sleep(25_000);

  const storageKeys = await page.evaluate(() =>
    Object.keys(localStorage).map((k) => ({
      key: k,
      looksLikeJwt: /^(eyJ|bearer )/i.test(localStorage.getItem(k) ?? ""),
      length: (localStorage.getItem(k) ?? "").length,
    })),
  );

  await browser.close();

  const all = [...hits.values()];
  const audio = all.filter((h) => h.isAudio);
  const api = all.filter((h) => !h.isAudio);
  const result = { url, session, audioRequests: audio, apiCalls: api, localStorageKeys: storageKeys };
  mkdirSync("out", { recursive: true });
  writeFileSync("out/inspect-audio.json", JSON.stringify(result, null, 2));

  console.log("\n=== Lyd-/stream-requests ===");
  for (const h of audio)
    console.log(`  ${h.status ?? "?"} [${h.resourceType}] ${h.contentType ?? ""} ${h.url}`);
  if (!audio.length) console.log("  (ingen — start avspilling manuelt og kjor pa nytt)");
  console.log("\n=== XHR/fetch (API-kandidater) ===");
  for (const h of api)
    console.log(`  ${h.status ?? "?"} ${h.method} ${h.hasAuth ? "[auth] " : ""}${h.url}`);
  console.log("\n=== localStorage (mulige tokens) ===");
  for (const k of storageKeys)
    console.log(`  ${k.looksLikeJwt ? "JWT? " : ""}${k.key} (${k.length} tegn)`);
  console.log("\nFull dump: out/inspect-audio.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
