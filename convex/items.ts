import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upsert pa url (dedup). `text` er innholdet (body/transkript). Status utledes:
 * har vi text -> "done", ellers "pending". Ved oppdatering beholdes eksisterende
 * text hvis vi ikke har ny (overskriver ikke ferdig innhold med tomt).
 */
export const upsert = mutation({
  args: {
    source: v.string(),
    type: v.union(v.literal("article"), v.literal("podcast")),
    url: v.string(),
    title: v.string(),
    publishedAt: v.optional(v.string()),
    text: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    textChars: v.optional(v.number()),
    fetchedAt: v.number(),
    author: v.optional(v.string()),
    section: v.optional(v.string()),
    looksPaywalled: v.optional(v.boolean()),
    extractSource: v.optional(
      v.union(v.literal("json-ld"), v.literal("dom"), v.literal("none")),
    ),
    program: v.optional(v.string()),
    programTitle: v.optional(v.string()),
    series: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    transcriptUrl: v.optional(v.string()),
    durationSec: v.optional(v.number()),
    audioBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hasText = Boolean(args.text && args.text.length > 0);
    const fields = {
      ...args,
      textStatus: (hasText ? "done" : "pending") as "done" | "pending",
    };

    const existing = await ctx.db
      .query("items")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();

    if (existing) {
      if (!hasText) {
        // Ikke overskriv eksisterende text/excerpt/status med tomt.
        const { text, excerpt, textChars, textStatus, ...meta } = fields;
        await ctx.db.patch(existing._id, meta);
      } else {
        await ctx.db.patch(existing._id, fields);
      }
      return { created: false, id: existing._id };
    }
    const id = await ctx.db.insert("items", fields);
    return { created: true, id };
  },
});

/** Siste N elementer, valgfritt filtrert pa source eller type. */
export const recent = query({
  args: {
    limit: v.optional(v.number()),
    source: v.optional(v.string()),
    type: v.optional(v.union(v.literal("article"), v.literal("podcast"))),
    series: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const source = args.source;
    const type = args.type;
    const series = args.series;
    if (series) {
      return await ctx.db
        .query("items")
        .withIndex("by_series", (q) => q.eq("series", series))
        .order("desc")
        .take(limit);
    }
    if (source) {
      return await ctx.db
        .query("items")
        .withIndex("by_source", (q) => q.eq("source", source))
        .order("desc")
        .take(limit);
    }
    if (type) {
      return await ctx.db
        .query("items")
        .withIndex("by_type", (q) => q.eq("type", type))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("items").order("desc").take(limit);
  },
});

/** Elementer som mangler innhold (f.eks. podkast uten VTT) — for transkribering. */
export const pending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("items")
      .withIndex("by_textStatus", (q) => q.eq("textStatus", "pending"))
      .take(args.limit ?? 50);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("items").collect();
    for (const row of all) await ctx.db.delete(row._id);
    return { deleted: all.length };
  },
});
