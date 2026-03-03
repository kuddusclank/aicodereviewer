// GitHub API helpers — pure functions that call external APIs.
// These are used by actions, not queries/mutations.

export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

export async function fetchGitHubRepos(
  accessToken: string,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub repos: ${response.status}`);
    }

    const data = (await response.json()) as GitHubRepo[];
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
}

export async function fetchPullRequests(
  accessToken: string,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<GitHubPullRequest[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const pulls = (await response.json()) as GitHubPullRequest[];

  const detailed = await Promise.all(
    pulls.map((pr) => fetchPullRequest(accessToken, owner, repo, pr.number)),
  );

  return detailed;
}

export async function fetchPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPullRequest> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return (await response.json()) as GitHubPullRequest;
}

export async function postReviewToGitHub(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  commitSha: string,
  summary: string,
  riskScore: number,
  comments: Array<{
    file: string;
    line: number;
    severity: string;
    category: string;
    message: string;
    suggestion?: string;
  }>,
): Promise<{ id: number; html_url: string }> {
  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
  };

  const categoryEmoji: Record<string, string> = {
    bug: "🐛",
    security: "🔒",
    performance: "⚡",
    style: "🎨",
    suggestion: "💡",
  };

  const riskLabel =
    riskScore < 25
      ? "Low"
      : riskScore < 50
        ? "Medium"
        : riskScore < 75
          ? "High"
          : "Critical";

  const body = [
    `## 🤖 AI Code Review`,
    ``,
    `**Risk Score:** ${riskScore}/100 (${riskLabel})`,
    ``,
    `### Summary`,
    summary,
    ``,
    `---`,
    `*Powered by [AI Code Reviewer](https://github.com/kuddusclank/aicodereviewer)*`,
  ].join("\n");

  // Normalize severity/category to lowercase to avoid misclassification
  const normalizedComments = comments.map((c) => ({
    ...c,
    severity: c.severity.toLowerCase(),
    category: c.category.toLowerCase(),
  }));

  const reviewComments = normalizedComments
    .filter((c) => c.file && c.line > 0)
    .map((c) => ({
      path: c.file,
      line: c.line,
      body: [
        `${severityEmoji[c.severity] || "⚪"} **${c.severity.toUpperCase()}** ${categoryEmoji[c.category] || ""} *${c.category}*`,
        ``,
        c.message,
        ...(c.suggestion ? [``, `**Suggestion:** ${c.suggestion}`] : []),
      ].join("\n"),
    }));

  const event =
    normalizedComments.some(
      (c) => c.severity === "critical" || c.severity === "high",
    )
      ? "REQUEST_CHANGES"
      : "COMMENT";

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commit_id: commitSha,
        body,
        event,
        comments: reviewComments,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    // If inline comments fail (e.g. line numbers don't map to diff), retry without them
    if (response.status === 422 && reviewComments.length > 0) {
      const fallback = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commit_id: commitSha,
            body:
              body +
              "\n\n### Comments\n" +
              normalizedComments
                .map(
                  (c) =>
                    `- ${severityEmoji[c.severity] || "⚪"} **${c.file}:${c.line}** — ${c.message}`,
                )
                .join("\n"),
            event,
            comments: [],
          }),
        },
      );
      if (!fallback.ok) {
        throw new Error(`GitHub review post failed: ${await fallback.text()}`);
      }
      return (await fallback.json()) as { id: number; html_url: string };
    }
    throw new Error(`GitHub review post failed: ${errorText}`);
  }

  return (await response.json()) as { id: number; html_url: string };
}

export async function fetchPullRequestFiles(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPullRequestFile[]> {
  const files: GitHubPullRequestFile[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as GitHubPullRequestFile[];
    files.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return files;
}
