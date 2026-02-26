import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getGitHubAccessToken } from "./helpers";
import { fetchPullRequestFiles, fetchPullRequest } from "./github";
import { reviewCode } from "./ai";
import ba from "./auth";

export const processReview = internalAction({
  args: {
    reviewId: v.id("reviews"),
    repositoryId: v.id("repositories"),
    prNumber: v.float64(),
    userId: v.string(),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { reviewId, repositoryId, prNumber, userId, providerId } = args;

    try {
      // Update status to PROCESSING
      await ctx.runMutation(internal.reviews.updateReviewStatus, {
        reviewId,
        status: "PROCESSING",
      });

      // Get repository
      const repository = await ctx.runQuery(
        internal.reviewWorker.getRepository,
        { repositoryId },
      );

      if (!repository) {
        await ctx.runMutation(internal.reviews.updateReviewStatus, {
          reviewId,
          status: "FAILED",
          error: "No repository found",
        });
        return;
      }

      // Get access token
      const accessToken = await getGitHubAccessToken(ctx, userId);

      if (!accessToken) {
        await ctx.runMutation(internal.reviews.updateReviewStatus, {
          reviewId,
          status: "FAILED",
          error: "GitHub access token not found",
        });
        return;
      }

      const [owner, repo] = repository.fullName.split("/");
      if (!owner || !repo) {
        await ctx.runMutation(internal.reviews.updateReviewStatus, {
          reviewId,
          status: "FAILED",
          error: "Invalid repository name",
        });
        return;
      }

      // Fetch PR files and PR details
      const [files, pr] = await Promise.all([
        fetchPullRequestFiles(accessToken, owner, repo, prNumber),
        fetchPullRequest(accessToken, owner, repo, prNumber),
      ]);

      // Generate review
      const reviewResult = await reviewCode(
        pr.title,
        files.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        })),
        providerId,
      );

      // Save result
      await ctx.runMutation(internal.reviews.updateReviewStatus, {
        reviewId,
        status: "COMPLETED",
        summary: reviewResult.summary,
        riskScore: reviewResult.riskScore,
        comments: reviewResult.comments,
        aiModel: reviewResult.aiModel,
      });
    } catch (error) {
      await ctx.runMutation(internal.reviews.updateReviewStatus, {
        reviewId,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

import { internalQuery } from "./_generated/server";

export const getRepository = internalQuery({
  args: { repositoryId: v.id("repositories") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.repositoryId);
  },
});
