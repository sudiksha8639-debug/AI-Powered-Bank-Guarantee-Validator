import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    templateId: v.id("templates"),
    filename: v.string(),
    documentType: v.string(),
    pageCount: v.number(),
    status: v.string(),
    passCount: v.number(),
    reviewCount: v.number(),
    failCount: v.number(),
    infoCount: v.number(),
    extractedText: v.string(),
    findings: v.array(
      v.object({
        category: v.string(),
        checkId: v.string(),
        label: v.string(),
        status: v.string(),
        detail: v.string(),
        pageNumber: v.optional(v.number()),
        extractedText: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify template belongs to user
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found");
    }

    const validationId = await ctx.db.insert("validations", {
      userId,
      templateId: args.templateId,
      filename: args.filename,
      documentType: args.documentType,
      pageCount: args.pageCount,
      status: args.status,
      passCount: args.passCount,
      reviewCount: args.reviewCount,
      failCount: args.failCount,
      infoCount: args.infoCount,
      extractedText: args.extractedText,
      createdAt: Date.now(),
    });

    // Insert findings
    for (const finding of args.findings) {
      await ctx.db.insert("validationFindings", {
        validationId,
        ...finding,
      });
    }

    return validationId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("validations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("validations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const validation = await ctx.db.get(args.id);
    if (!validation || validation.userId !== userId) {
      throw new Error("Validation not found");
    }
    return validation;
  },
});

export const getFindings = query({
  args: { validationId: v.id("validations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const validation = await ctx.db.get(args.validationId);
    if (!validation || validation.userId !== userId) {
      throw new Error("Validation not found");
    }

    return await ctx.db
      .query("validationFindings")
      .withIndex("by_validation", (q) =>
        q.eq("validationId", args.validationId)
      )
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id("validations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const validation = await ctx.db.get(args.id);
    if (!validation || validation.userId !== userId) {
      throw new Error("Validation not found");
    }

    // Delete associated findings
    const findings = await ctx.db
      .query("validationFindings")
      .withIndex("by_validation", (q) => q.eq("validationId", args.id))
      .collect();

    for (const finding of findings) {
      await ctx.db.delete(finding._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, valid: 0, review: 0, discrepant: 0 };

    const validations = await ctx.db
      .query("validations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      total: validations.length,
      valid: validations.filter((v) => v.status === "VALID").length,
      review: validations.filter((v) => v.status === "REVIEW").length,
      discrepant: validations.filter((v) => v.status === "DISCREPANT").length,
    };
  },
});
