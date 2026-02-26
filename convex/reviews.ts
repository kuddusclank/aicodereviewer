import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { getAuthenticatedUser, getGitHubAccessToken } from "./helpers";
import { fetchPullRequest } from "./github";
import { getAvailableProviders } from "./ai";
import { Id } from "./_generated/dataModel";

export const availableModels = query({
  args: {},
  handler: async () => {
    return getAvailableProviders();
  },
});

export const trigger = action({
  args: {
    repositoryId: v.id("repositories"),
    prNumber: v.float64(),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const repository = await ctx.runQuery(api.repositories.getById, {
      id: args.repositoryId,
    });
    if (!repository) {
      throw new Error("Repository not found");
    }

    const accessToken = await getGitHubAccessToken(ctx, user.id);
    if (!accessToken) {
      throw new Error("GitHub account not connected");
    }

    const [owner, repo] = repository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repository name");
    }

    const pr = await fetchPullRequest(
      accessToken,
      owner,
      repo,
      args.prNumber,
    );

    // Create review record and schedule worker
    const reviewId = await ctx.runMutation(internal.reviews.createReview, {
      repositoryId: args.repositoryId,
      userId: user.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.html_url,
      providerId: args.providerId,
    });

    return { reviewId };
  },
});

export const createReview = internalMutation({
  args: {
    repositoryId: v.id("repositories"),
    userId: v.string(),
    prNumber: v.float64(),
    prTitle: v.string(),
    prUrl: v.string(),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reviewId = await ctx.db.insert("reviews", {
      repositoryId: args.repositoryId,
      userId: args.userId,
      prNumber: args.prNumber,
      prTitle: args.prTitle,
      prUrl: args.prUrl,
      status: "PENDING",
    });

    // Schedule the review worker to run immediately
    await ctx.scheduler.runAfter(0, internal.reviewWorker.processReview, {
      reviewId,
      repositoryId: args.repositoryId,
      prNumber: args.prNumber,
      userId: args.userId,
      providerId: args.providerId,
    });

    return reviewId;
  },
});

export const get = query({
  args: { id: v.id("reviews") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review || review.userId !== user.id) {
      throw new Error("Review not found");
    }

    const repository = await ctx.db.get(review.repositoryId);
    return { ...review, repository };
  },
});

export const list = query({
  args: {
    repositoryId: v.optional(v.id("repositories")),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = args.limit ?? 20;

    let reviewQuery;
    if (args.repositoryId) {
      reviewQuery = ctx.db
        .query("reviews")
        .withIndex("by_userId_repositoryId", (q) =>
          q.eq("userId", user.id).eq("repositoryId", args.repositoryId!),
        );
    } else {
      reviewQuery = ctx.db
        .query("reviews")
        .withIndex("by_userId", (q) => q.eq("userId", user.id));
    }

    const reviews = await reviewQuery.order("desc").take(limit);

    // Attach repository info
    const results = await Promise.all(
      reviews.map(async (review) => {
        const repository = await ctx.db.get(review.repositoryId);
        return { ...review, repository };
      }),
    );

    return results;
  },
});

export const getLatestForPR = query({
  args: {
    repositoryId: v.id("repositories"),
    prNumber: v.float64(),
  },
  handler: async (ctx, args) => {
    const review = await ctx.db
      .query("reviews")
      .withIndex("by_repositoryId_prNumber", (q) =>
        q.eq("repositoryId", args.repositoryId).eq("prNumber", args.prNumber),
      )
      .order("desc")
      .first();

    return review;
  },
});

export const getReviewsForPRs = query({
  args: {
    repositoryId: v.id("repositories"),
    prNumbers: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      prNumber: number;
      status: string;
      _creationTime: number;
    }> = [];

    for (const prNumber of args.prNumbers) {
      const review = await ctx.db
        .query("reviews")
        .withIndex("by_repositoryId_prNumber", (q) =>
          q.eq("repositoryId", args.repositoryId).eq("prNumber", prNumber),
        )
        .order("desc")
        .first();

      if (review) {
        results.push({
          prNumber: review.prNumber,
          status: review.status,
          _creationTime: review._creationTime,
        });
      }
    }

    return results;
  },
});

export const updateReviewStatus = internalMutation({
  args: {
    reviewId: v.id("reviews"),
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
  },
  handler: async (ctx, args) => {
    const { reviewId, ...updates } = args;
    // Filter out undefined values
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(reviewId, patch);
  },
});
