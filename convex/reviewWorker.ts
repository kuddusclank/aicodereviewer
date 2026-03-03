import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getGitHubAccessToken } from "./helpers";
import {
  fetchPullRequestFiles,
  fetchPullRequest,
  postReviewToGitHub,
} from "./github";
import { reviewCode } from "./ai";

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

      // Auto-post to GitHub if enabled
      if (repository.autoPostToGitHub) {
        try {
          // Idempotency guard: claim the post atomically before calling GitHub
          const claimed = await ctx.runMutation(
            internal.reviews.claimGitHubPost,
            { reviewId },
          );
          if (claimed) {
            await postReviewToGitHub(
              accessToken,
              owner,
              repo,
              prNumber,
              pr.head.sha,
              reviewResult.summary,
              reviewResult.riskScore,
              reviewResult.comments,
            );
            await ctx.runMutation(internal.reviews.updateReviewStatus, {
              reviewId,
              status: "COMPLETED",
              postedToGitHub: true,
            });
          }
        } catch (postError) {
          // Don't fail the review if posting fails — log sanitized error only
          const message =
            postError instanceof Error ? postError.message : "Unknown error";
          console.error("Failed to post review to GitHub", {
            reviewId,
            repositoryId,
            prNumber,
            message,
          });
        }
      }
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
