/**
 * Henter en artikkel med den innloggede sesjonen og trekker ut fulltekst +
 * metadata. Innholdet returneres til kalleren — det er opp til pipelinen om
 * det matches og forkastes. Vi lagrer det ikke her.
 *
 * Uttrekks-strategi (mest palitelig forst):
 *   1. JSON-LD NewsArticle.articleBody
 *   2. <article> / brodtekst-paragrafer i DOM
 * Pluss metadata fra JSON-LD + Open Graph-tags.
 */
import type { BrowserContext } from "playwright";

export interface ArticleResult {
  url: string;
  title: string;
  author?: string;
  section?: string;
  publishedAt?: string;
  body: string;
  bodyChars: number;
  /** Heuristikk: ser teksten avkortet ut (betalingsmur / utlogget)? */
  looksPaywalled: boolean;
  /** Hvilken strategi som ga brodteksten */
  source: "json-ld" | "dom" | "none";
}

export async function fetchArticle(
  ctx: BrowserContext,
  url: string,
  opts: { paywallMinChars?: number } = {},
): Promise<ArticleResult> {
  const paywallMinChars = opts.paywallMinChars ?? 400;
  const page = await ctx.newPage();
  try {
    // tsx/esbuild (keepNames) injiserer en __name-helper i funksjoner sendt til
    // page.evaluate; den finnes ikke i browseren. Definer en no-op shim.
    await page.addInitScript(() => {
      (globalThis as any).__name = (globalThis as any).__name || ((fn: any) => fn);
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // La klient-rendret brodtekst rekke a komme inn
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const extracted = await page.evaluate(() => {
      // ---- JSON-LD ----
      let ld: any = null;
      for (const el of Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      )) {
        try {
          const parsed = JSON.parse(el.textContent || "");
          const nodes = Array.isArray(parsed)
            ? parsed
            : parsed["@graph"] ?? [parsed];
          for (const n of nodes) {
            const t = n["@type"];
            const types = Array.isArray(t) ? t : [t];
            if (
              types.some((x: string) =>
                /NewsArticle|Article|ReportageNewsArticle/i.test(x),
              )
            ) {
              ld = n;
              break;
            }
          }
        } catch {
          /* hopp over ugyldig JSON-LD */
        }
        if (ld) break;
      }

      const meta = (prop: string) =>
        document
          .querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)
          ?.getAttribute("content") || undefined;

      // ---- Brodtekst ----
      let body = "";
      let source: "json-ld" | "dom" | "none" = "none";
      if (ld?.articleBody && String(ld.articleBody).trim().length > 0) {
        body = String(ld.articleBody).trim();
        source = "json-ld";
      } else {
        const root =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.body;
        const paras = Array.from(root.querySelectorAll("p"))
          .map((p) => (p.textContent || "").trim())
          .filter((t) => t.length > 0);
        if (paras.length) {
          body = paras.join("\n\n");
          source = "dom";
        }
      }

      const author = (() => {
        const a = ld?.author;
        if (!a) return undefined;
        if (Array.isArray(a)) return a.map((x) => x?.name).filter(Boolean).join(", ");
        return a.name ?? undefined;
      })();

      return {
        title:
          ld?.headline ||
          meta("og:title") ||
          document.title ||
          "",
        author,
        section: ld?.articleSection || meta("article:section"),
        publishedAt: ld?.datePublished || meta("article:published_time"),
        body,
        source,
      };
    });

    const bodyChars = extracted.body.length;
    // Heuristikk for avkortet/betalingsmur: svaert kort brodtekst.
    const looksPaywalled = bodyChars < paywallMinChars;

    return {
      url,
      title: extracted.title.trim(),
      author: extracted.author,
      section: extracted.section,
      publishedAt: extracted.publishedAt,
      body: extracted.body,
      bodyChars,
      looksPaywalled,
      source: extracted.source,
    };
  } finally {
    await page.close();
  }
}
