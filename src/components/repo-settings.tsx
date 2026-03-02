"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Github, Trophy, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RepoSettingsProps {
  repositoryId: Id<"repositories">;
  fullName: string;
  autoPostToGitHub: boolean;
  isPublic: boolean;
  convexSiteUrl?: string;
}

export function RepoSettings({
  repositoryId,
  fullName,
  autoPostToGitHub,
  isPublic,
  convexSiteUrl,
}: RepoSettingsProps) {
  const updateSettings = useMutation(api.repositories.updateSettings);
  const [copied, setCopied] = useState(false);

  const badgeUrl = convexSiteUrl
    ? `${convexSiteUrl}/badge/${fullName}.svg`
    : `https://your-deployment.convex.site/badge/${fullName}.svg`;
  const badgeMarkdown = `[![Code Health](${badgeUrl})](https://github.com/${fullName})`;

  const handleCopy = () => {
    navigator.clipboard.writeText(badgeMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Github className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Auto-post reviews to GitHub</p>
              <p className="text-xs text-muted-foreground">
                Post AI review as a GitHub PR Review with inline comments
              </p>
            </div>
          </div>
          <Switch
            checked={autoPostToGitHub}
            onCheckedChange={(checked) =>
              updateSettings({ id: repositoryId, autoPostToGitHub: checked })
            }
          />
        </div>

        <div className="border-t border-border/60" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Trophy className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Public leaderboard</p>
              <p className="text-xs text-muted-foreground">
                Show this repo on the public code health leaderboard
              </p>
            </div>
          </div>
          <Switch
            checked={isPublic}
            onCheckedChange={(checked) =>
              updateSettings({ id: repositoryId, isPublic: checked })
            }
          />
        </div>

        {isPublic && (
          <>
            <div className="border-t border-border/60" />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                README Badge
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate">
                  {badgeMarkdown}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              {/* Badge preview */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badgeUrl}
                  alt="Code Health Badge"
                  className="h-5"
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
