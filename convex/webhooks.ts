import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

interface PullRequestPayload {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    html_url: string;
    state: string;
    draft: boolean;
  };
  repository: {
    id: number;
    full_name: string;
  };
}

async function verifySignature(
  payload: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("GITHUB_WEBHOOK_SECRET not set, skipping verification");
    return true;
  }

  if (!signature) {
    return false;
  }

  // Use Web Crypto API (available in Convex runtime)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  const expectedSignature =
    "sha256=" +
    Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return signature === expectedSignature;
}

export const handleGitHubWebhook = httpAction(async (ctx, request) => {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");

  // Verify the webhook signature
  const isValid = await verifySignature(payload, signature);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only handle pull_request events
  if (event !== "pull_request") {
    return new Response(JSON.stringify({ message: "Event ignored" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = JSON.parse(payload) as PullRequestPayload;

  // Only trigger on open, synchronize (new commits), or reopen
  if (!["opened", "synchronize", "reopened"].includes(data.action)) {
    return new Response(
      JSON.stringify({ message: `Action '${data.action}' ignored` }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Skip draft PRs
  if (data.pull_request.draft) {
    return new Response(JSON.stringify({ message: "Draft PR ignored" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle the PR event
  const result = await ctx.runMutation(internal.webhooks.handleGitHubPR, {
    githubRepoId: data.repository.id,
    prNumber: data.pull_request.number,
    prTitle: data.pull_request.title,
    prUrl: data.pull_request.html_url,
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const handleGitHubPR = internalMutation({
  args: {
    githubRepoId: v.float64(),
    prNumber: v.float64(),
    prTitle: v.string(),
    prUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the repository in our database
    const repository = await ctx.db
      .query("repositories")
      .withIndex("by_githubId", (q) => q.eq("githubId", args.githubRepoId))
      .first();

    if (!repository) {
      return { message: "Repository not connected" };
    }

    // Check if there's already a review in progress
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_repositoryId_prNumber", (q) =>
        q
          .eq("repositoryId", repository._id)
          .eq("prNumber", args.prNumber),
      )
      .order("desc")
      .first();

    if (
      existingReview &&
      (existingReview.status === "PENDING" ||
        existingReview.status === "PROCESSING")
    ) {
      return { message: "Review already in progress" };
    }

    // Create a new review record
    const reviewId = await ctx.db.insert("reviews", {
      repositoryId: repository._id,
      userId: repository.userId,
      prNumber: args.prNumber,
      prTitle: args.prTitle,
      prUrl: args.prUrl,
      status: "PENDING",
    });

    // Schedule the review worker
    await ctx.scheduler.runAfter(0, internal.reviewWorker.processReview, {
      reviewId,
      repositoryId: repository._id,
      prNumber: args.prNumber,
      userId: repository.userId,
    });

    return { message: "Review triggered", reviewId };
  },
});
