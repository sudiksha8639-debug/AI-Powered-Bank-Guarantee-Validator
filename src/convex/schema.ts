import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    templates: defineTable({
      userId: v.id("users"),
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
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    validations: defineTable({
      userId: v.id("users"),
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
      userInstructions: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    validationFindings: defineTable({
      validationId: v.id("validations"),
      category: v.string(),
      checkId: v.string(),
      label: v.string(),
      status: v.string(),
      detail: v.string(),
      pageNumber: v.optional(v.number()),
      extractedText: v.optional(v.string()),
    }).index("by_validation", ["validationId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
