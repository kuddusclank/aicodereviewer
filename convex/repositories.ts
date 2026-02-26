import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthenticatedUser, getGitHubAccessToken } from "./helpers";
import { fetchGitHubRepos } from "./github";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return ctx.db
      .query("repositories")
      .withIndex("by_userId", (q) => q.eq("userId", user.id))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("repositories") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const repo = await ctx.db.get(args.id);
    if (!repo || repo.userId !== user.id) return null;
    return repo;
  },
});

export const fetchFromGithub = action({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const accessToken = await getGitHubAccessToken(ctx, user.id);

    if (!accessToken) {
      throw new Error("User has not authorized GitHub access");
    }

    const repos = await fetchGitHubRepos(accessToken);
    return repos.map((repo) => ({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at,
    }));
  },
});

export const connect = mutation({
  args: {
    repos: v.array(
      v.object({
        githubId: v.float64(),
        name: v.string(),
        fullName: v.string(),
        isPrivate: v.boolean(),
        htmlUrl: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    let connected = 0;

    for (const repo of args.repos) {
      // Check if already exists by githubId
      const existing = await ctx.db
        .query("repositories")
        .withIndex("by_githubId", (q) => q.eq("githubId", repo.githubId))
        .first();

      if (existing) {
        // Update existing
        await ctx.db.patch(existing._id, {
          name: repo.name,
          fullName: repo.fullName,
          isPrivate: repo.isPrivate,
          htmlUrl: repo.htmlUrl,
          updatedAt: Date.now(),
        });
      } else {
        // Create new
        await ctx.db.insert("repositories", {
          userId: user.id,
          githubId: repo.githubId,
          name: repo.name,
          fullName: repo.fullName,
          isPrivate: repo.isPrivate,
          htmlUrl: repo.htmlUrl,
          updatedAt: Date.now(),
        });
      }
      connected++;
    }

    return { connected };
  },
});

export const disconnect = mutation({
  args: { id: v.id("repositories") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const repo = await ctx.db.get(args.id);
    if (!repo || repo.userId !== user.id) {
      throw new Error("Repository not found");
    }

    // Delete associated reviews first
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_repositoryId", (q) => q.eq("repositoryId", args.id))
      .collect();
    for (const review of reviews) {
      await ctx.db.delete(review._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
