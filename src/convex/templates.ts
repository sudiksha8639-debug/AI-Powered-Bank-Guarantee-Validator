import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    filename: v.string(),
    extractedText: v.string(),
    clauses: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        content: v.string(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("templates", {
      userId,
      filename: args.filename,
      extractedText: args.extractedText,
      clauses: args.clauses,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }
    return template;
  },
});

export const remove = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const template = await ctx.db.get(args.id);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }
    await ctx.db.delete(args.id);
  },
});
