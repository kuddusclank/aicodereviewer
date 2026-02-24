import { LinearClient } from "@linear/sdk";
import { db } from "@/server/db";

export interface LinearIssueInfo {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: { name: string; color: string; type: string } | null;
  priority: number;
  assignee: { name: string; avatarUrl: string | null } | null;
}

/**
 * Extract a Linear issue identifier (e.g. ENG-123) from a PR title or branch name.
 * Checks title first, then upper-cased branch name. Returns first match or null.
 */
export function extractLinearIssueId(
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

/**
 * Get a LinearClient for the given user, or null if no API key is stored.
 */
export async function getLinearClient(
  userId: string,
): Promise<LinearClient | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { linearApiKey: true },
  });

  if (!user?.linearApiKey) return null;

  return new LinearClient({ apiKey: user.linearApiKey });
}

/**
 * Fetch a Linear issue by identifier (e.g. "ENG-123"), resolving state and assignee.
 * Returns null if the issue is not found or on error.
 */
export async function fetchLinearIssue(
  client: LinearClient,
  identifier: string,
): Promise<LinearIssueInfo | null> {
  try {
    const issue = await client.issueSearch(identifier, { first: 1 });
    const node = issue.nodes[0];
    if (!node || node.identifier !== identifier) return null;

    const [state, assignee] = await Promise.all([
      node.state,
      node.assignee,
    ]);

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
