import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthenticatedUser, getGitHubAccessToken } from "./helpers";
import {
  fetchPullRequests,
  fetchPullRequest,
  fetchPullRequestFiles,
} from "./github";

export const list = action({
  args: {
    repositoryId: v.id("repositories"),
    state: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("all"),
    ),
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
      throw new Error("Github account not connected");
    }

    const [owner, repo] = repository.fullName.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repository name");
    }

    const prs = await fetchPullRequests(accessToken, owner, repo, args.state);

    // Get existing reviews for these PRs
    const reviews = await ctx.runQuery(api.reviews.getReviewsForPRs, {
      repositoryId: args.repositoryId,
      prNumbers: prs.map((pr) => pr.number),
    });

    const reviewMap = new Map(
      reviews.map((r: { prNumber: number; status: string; _creationTime: number }) => [
        r.prNumber,
        r,
      ]),
    );

    return prs.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      htmlUrl: pr.html_url,
      author: {
        login: pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      review: reviewMap.get(pr.number) ?? null,
    }));
  },
});

export const get = action({
  args: {
    repositoryId: v.id("repositories"),
    prNumber: v.float64(),
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

    const pr = await fetchPullRequest(accessToken, owner, repo, args.prNumber);

    const existingReview = await ctx.runQuery(api.reviews.getLatestForPR, {
      repositoryId: args.repositoryId,
      prNumber: args.prNumber,
    });

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      htmlUrl: pr.html_url,
      author: {
        login: pr.user.login,
        avatarUrl: pr.user.avatar_url,
      },
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      review: existingReview,
    };
  },
});

export const files = action({
  args: {
    repositoryId: v.id("repositories"),
    prNumber: v.float64(),
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

    const prFiles = await fetchPullRequestFiles(
      accessToken,
      owner,
      repo,
      args.prNumber,
    );

    return prFiles.map((file) => ({
      sha: file.sha,
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previousFilename: file.previous_filename,
    }));
  },
});
