/**
 * Henter og parser et WEBVTT-transkript til ren fulltekst.
 */
const UA = { "user-agent": "cc-news/0.1 (intern mediovervaking)" };

export async function fetchTranscript(
  vttUrl: string,
): Promise<string | null> {
  const res = await fetch(vttUrl, { headers: UA });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`VTT ${vttUrl} ga HTTP ${res.status}`);
  return vttToText(await res.text());
}

export function vttToText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "WEBVTT") continue;
    if (line.startsWith("NOTE")) continue;
    if (line.includes("-->")) continue;
    if (/^\d+$/.test(line)) continue;
    if (out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
