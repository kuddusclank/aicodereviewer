"use client";

import type { LinearIssueInfo } from "@/server/services/linear";

interface LinearIssueBadgeProps {
  issue: LinearIssueInfo;
  compact?: boolean;
}

export function LinearIssueBadge({
  issue,
  compact = false,
}: LinearIssueBadgeProps) {
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
      title={compact ? `${issue.identifier}: ${issue.title}` : undefined}
    >
      {issue.state && (
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: issue.state.color }}
        />
      )}
      <span className="font-mono">{issue.identifier}</span>
      {!compact && (
        <span className="text-muted-foreground truncate max-w-48">
          {issue.title}
        </span>
      )}
    </a>
  );
}
