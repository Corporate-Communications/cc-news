import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Én felles tabell for alt innhold — artikler og podkast-episoder.
 * `type` skiller dem; `text` holder selve innholdet (artikkel-body ELLER
 * podkast-transkript) slik at samme felter kan hentes uansett kilde/type.
 */
export default defineSchema({
  items: defineTable({
    // --- Felles (alltid) ---
    source: v.string(), // kilde-id: "aftenposten", "nrk"
    type: v.union(v.literal("article"), v.literal("podcast")),
    url: v.string(), // klikkbar lenke; leseren apner med egen konto
    title: v.string(),
    publishedAt: v.optional(v.string()),
    text: v.optional(v.string()), // body (artikkel) | transkript (podkast)
    excerpt: v.optional(v.string()),
    textChars: v.optional(v.number()),
    // "done" = innhold hentet; "pending" = mangler (f.eks. podkast uten VTT)
    textStatus: v.union(v.literal("done"), v.literal("pending")),
    fetchedAt: v.number(),

    // --- Felles metadata (valgfritt) ---
    author: v.optional(v.string()),
    section: v.optional(v.string()),

    // --- Artikkel-spesifikt ---
    looksPaywalled: v.optional(v.boolean()),
    extractSource: v.optional(
      v.union(v.literal("json-ld"), v.literal("dom"), v.literal("none")),
    ),

    // --- Podkast-spesifikt ---
    program: v.optional(v.string()),
    programTitle: v.optional(v.string()),
    series: v.optional(v.string()), // undertype: Aftenpodden / Politikerne / Ekstra Lars
    coverImageId: v.optional(v.string()), // ra cover-signal
    audioUrl: v.optional(v.string()),
    transcriptUrl: v.optional(v.string()),
    durationSec: v.optional(v.number()),
    audioBytes: v.optional(v.number()),
  })
    .index("by_url", ["url"]) // dedup + oppslag
    .index("by_source", ["source"])
    .index("by_type", ["type"])
    .index("by_series", ["series"])
    .index("by_textStatus", ["textStatus"]),
});
