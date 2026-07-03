/** Lister konfigurerte kilder og status. `npm run sources` */
import { SOURCES } from "./sources/registry.js";
import { authLabelForSource } from "./auth/resolve.js";
import { isArticleSource, isPodcastSource } from "./sources/types.js";

console.log("Konfigurerte kilder:\n");
for (const s of SOURCES) {
  const auth = isArticleSource(s) ? authLabelForSource(s) : "—";
  const sched = s.schedule?.everyMinutes
    ? `hver ${s.schedule.everyMinutes} min`
    : "ingen plan";

  let fetchInfo = "";
  if (isArticleSource(s)) {
    fetchInfo = `discovery=${s.discovery.strategy}`;
  } else if (isPodcastSource(s)) {
    const f = s.fetch;
    if (f.strategy === "ap-svp") {
      fetchInfo =
        f.programs === "all"
          ? "fetch=ap-svp (alle programmer)"
          : `fetch=ap-svp (${f.programs.length} programmer)`;
    } else if (f.strategy === "nrk-psapi") {
      fetchInfo = `fetch=nrk-psapi (${f.slugs.length} slugs)`;
    } else {
      fetchInfo = `fetch=rss`;
    }
  }

  console.log(
    `  ${s.enabled ? "●" : "○"} ${s.id.padEnd(20)} ${s.name} [${s.contentType}]`,
  );
  console.log(`      auth=${auth} | ${fetchInfo} | ${sched}`);
}
