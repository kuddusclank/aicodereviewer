import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

export const getPublicLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    // Get all public repositories
    const repos = await ctx.db
      .query("repositories")
      .withIndex("by_isPublic", (q) => q.eq("isPublic", true))
      .collect();

    const leaderboard = await Promise.all(
      repos.map(async (repo) => {
        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_repositoryId", (q) =>
            q.eq("repositoryId", repo._id),
          )
          .order("desc")
          .take(50);

        const completedReviews = reviews.filter(
          (r) => r.status === "COMPLETED" && r.riskScore !== undefined,
        );

        if (completedReviews.length === 0) return null;

        const avgRiskScore = Math.round(
          completedReviews.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) /
            completedReviews.length,
        );

        // Trend: compare last 5 vs previous 5
        const recent = completedReviews.slice(0, 5);
        const older = completedReviews.slice(5, 10);
        const recentAvg =
          recent.length > 0
            ? recent.reduce((s, r) => s + (r.riskScore ?? 0), 0) /
              recent.length
            : avgRiskScore;
        const olderAvg =
          older.length > 0
            ? older.reduce((s, r) => s + (r.riskScore ?? 0), 0) / older.length
            : avgRiskScore;
        const trend = Math.round(olderAvg - recentAvg); // positive = improving

        const totalComments = completedReviews.reduce(
          (sum, r) => sum + (Array.isArray(r.comments) ? r.comments.length : 0),
          0,
        );

        return {
          repoId: repo._id,
          name: repo.name,
          fullName: repo.fullName,
          htmlUrl: repo.htmlUrl,
          avgRiskScore,
          totalReviews: completedReviews.length,
          totalComments,
          trend,
          lastReviewAt: completedReviews[0]?._creationTime ?? 0,
        };
      }),
    );

    return leaderboard
      .filter(Boolean)
      .sort((a, b) => a!.avgRiskScore - b!.avgRiskScore);
  },
});

// Internal query used by the badge HTTP endpoint
export const getRepoBadgeData = internalQuery({
  args: { fullName: v.string() },
  handler: async (ctx, args) => {
    // Use index lookup instead of full table scan
    const repo = await ctx.db
      .query("repositories")
      .withIndex("by_fullName", (q) => q.eq("fullName", args.fullName))
      .first();

    if (!repo || !repo.isPublic) return null;

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_repositoryId", (q) => q.eq("repositoryId", repo._id))
      .order("desc")
      .take(20);

    const completed = reviews.filter(
      (r) => r.status === "COMPLETED" && r.riskScore !== undefined,
    );

    if (completed.length === 0) return null;

    const avgRiskScore = Math.round(
      completed.reduce((s, r) => s + (r.riskScore ?? 0), 0) / completed.length,
    );

    return {
      fullName: repo.fullName,
      avgRiskScore,
      totalReviews: completed.length,
    };
  },
});
