/**
 * Manuell innlogging for en auth-gruppe (delt pa tvers av publikasjoner).
 *
 *   npm run login schibsted      # Aftenposten, VG, BT, …
 *   npm run login dn-media       # TradeWinds, DN, …
 *   npm run login tradewinds     # alias → dn-media
 *   npm run login aftenposten    # alias → schibsted
 *
 * Apner en headed Chromium pa gruppens login-URL. Logg inn manuelt, trykk ENTER.
 * Sesjonen lagres til sessions/<gruppe-id>.json.
 */
import { chromium } from "playwright";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdirSync } from "node:fs";
import { AUTH_GROUP_IDS } from "./auth/groups.js";
import {
  resolveLoginTarget,
  sessionPathForGroup,
  sourcesForAuthGroup,
} from "./auth/resolve.js";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Bruk: npm run login <auth-gruppe|kilde-id>\n");
    console.error("Auth-grupper:");
    for (const id of AUTH_GROUP_IDS) {
      const sources = sourcesForAuthGroup(id);
      const pubs = sources.map((s) => s.id).join(", ") || "(ingen kilder enna)";
      console.error(`  ${id.padEnd(12)} — ${pubs}`);
    }
    process.exit(1);
  }

  const target = resolveLoginTarget(arg);
  if (!target) {
    console.error(
      `Ukjent «${arg}». Bruk auth-gruppe (${AUTH_GROUP_IDS.join(", ")}) eller en kilde-id med betalingsmur.`,
    );
    process.exit(1);
  }

  const { group } = target;
  const via =
    target.kind === "source"
      ? ` (via kilde ${target.source.id})`
      : "";

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(group.loginUrl);

  const shared = sourcesForAuthGroup(group.id).map((s) => s.name).join(", ");
  console.log(
    `\n→ ${group.name}${via}\n` +
      `  Apner ${group.loginUrl}\n` +
      `  Delt sesjon for: ${shared || group.publications.join(", ")}\n` +
      "  Godta cookies og logg inn (inkl. evt. 2FA).\n",
  );

  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question("Trykk ENTER naar du er ferdig innlogget … ");
  rl.close();

  mkdirSync("sessions", { recursive: true });
  const path = sessionPathForGroup(group.id);
  await ctx.storageState({ path });
  console.log(`\n✓ Sesjon lagret til ${path}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
