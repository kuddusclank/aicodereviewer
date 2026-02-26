import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthenticatedUser } from "./helpers";
import { LinearClient } from "@linear/sdk";

export interface LinearIssueInfo {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: { name: string; color: string; type: string } | null;
  priority: number;
  assignee: { name: string; avatarUrl: string | null } | null;
}

export const saveApiKey = mutation({
  args: { apiKey: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        linearApiKey: args.apiKey ?? undefined,
      });
    } else if (args.apiKey) {
      await ctx.db.insert("userSettings", {
        userId: user.id,
        linearApiKey: args.apiKey,
      });
    }

    return { success: true };
  },
});

export const isConnected = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user.id))
      .first();
    return { connected: !!settings?.linearApiKey };
  },
});

function extractLinearIssueId(
  branchName: string,
  prTitle: string,
): string | null {
  const pattern = /\b([A-Z]{1,5}-\d+)\b/g;

  const titleMatch = prTitle.match(pattern);
  if (titleMatch) return titleMatch[0];

  const branchMatch = branchName.toUpperCase().match(pattern);
  if (branchMatch) return branchMatch[0];

  return null;
}

async function fetchLinearIssue(
  client: LinearClient,
  identifier: string,
): Promise<LinearIssueInfo | null> {
  try {
    const issue = await client.issueSearch(identifier, { first: 1 });
    const node = issue.nodes[0];
    if (!node || node.identifier !== identifier) return null;

    const [state, assignee] = await Promise.all([node.state, node.assignee]);

    return {
      id: node.id,
      identifier: node.identifier,
      title: node.title,
      url: node.url,
      state: state
        ? { name: state.name, color: state.color, type: state.type }
        : null,
      priority: node.priority,
      assignee: assignee
        ? { name: assignee.name, avatarUrl: assignee.avatarUrl ?? null }
        : null,
    };
  } catch {
    return null;
  }
}

export const getIssueForPR = action({
  args: {
    branchName: v.string(),
    prTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const settings = await ctx.runQuery(api.linear.getUserSettings, {});
    if (!settings?.linearApiKey) return null;

    const identifier = extractLinearIssueId(args.branchName, args.prTitle);
    if (!identifier) return null;

    const client = new LinearClient({ apiKey: settings.linearApiKey });
    return fetchLinearIssue(client, identifier);
  },
});

export const getIssuesForPRs = action({
  args: {
    prs: v.array(
      v.object({
        number: v.float64(),
        title: v.string(),
        headRef: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const settings = await ctx.runQuery(api.linear.getUserSettings, {});
    if (!settings?.linearApiKey)
      return {} as Record<number, LinearIssueInfo>;

    const client = new LinearClient({ apiKey: settings.linearApiKey });

    // Deduplicate: group PR numbers by their extracted identifier
    const identifierToPrNumbers = new Map<string, number[]>();
    for (const pr of args.prs) {
      const id = extractLinearIssueId(pr.headRef, pr.title);
      if (!id) continue;
      const existing = identifierToPrNumbers.get(id) ?? [];
      existing.push(pr.number);
      identifierToPrNumbers.set(id, existing);
    }

    const result: Record<number, LinearIssueInfo> = {};

    const entries = Array.from(identifierToPrNumbers.entries());
    const issues = await Promise.all(
      entries.map(([identifier]) => fetchLinearIssue(client, identifier)),
    );

    for (let i = 0; i < entries.length; i++) {
      const issue = issues[i];
      if (!issue) continue;
      const prNumbers = entries[i][1];
      for (const prNumber of prNumbers) {
        result[prNumber] = issue;
      }
    }

    return result;
  },
});

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user.id))
      .first();
  },
});
