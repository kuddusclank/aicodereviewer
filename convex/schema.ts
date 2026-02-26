import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  repositories: defineTable({
    userId: v.string(),
    githubId: v.float64(),
    name: v.string(),
    fullName: v.string(),
    isPrivate: v.boolean(),
    htmlUrl: v.string(),
    updatedAt: v.float64(),
  })
    .index("by_userId", ["userId"])
    .index("by_githubId", ["githubId"]),

  reviews: defineTable({
    repositoryId: v.id("repositories"),
    userId: v.string(),
    prNumber: v.float64(),
    prTitle: v.string(),
    prUrl: v.string(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PROCESSING"),
      v.literal("COMPLETED"),
      v.literal("FAILED"),
    ),
    summary: v.optional(v.string()),
    riskScore: v.optional(v.float64()),
    comments: v.optional(v.any()),
    aiModel: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_repositoryId", ["repositoryId"])
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_repositoryId_prNumber", ["repositoryId", "prNumber"])
    .index("by_userId_repositoryId", ["userId", "repositoryId"]),

  userSettings: defineTable({
    userId: v.string(),
    linearApiKey: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
});
