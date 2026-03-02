"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  ScanSearch,
  GitPullRequest,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const leaderboard = useQuery(api.leaderboard.getPublicLeaderboard);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            CodeReviewAI
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/leaderboard">Leaderboard</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium mb-4">
            <Trophy className="size-4" />
            Code Health Leaderboard
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Cleanest codebases
          </h1>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Repositories ranked by AI code review scores. Lower risk scores mean
            cleaner, more maintainable code.
          </p>
        </div>

        {leaderboard === undefined ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto size-14 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="size-7 text-muted-foreground" />
              </div>
              <p className="mt-4 font-medium">No public repositories yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Repository owners can opt-in to the public leaderboard from
                their repository settings.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/sign-up">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <LeaderboardCard
                key={entry!.repoId}
                entry={entry!}
                rank={index + 1}
              />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Want your repo on the leaderboard?
          </p>
          <Button className="mt-3" asChild>
            <Link href="/sign-up">
              Get started for free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function LeaderboardCard({
  entry,
  rank,
}: {
  entry: {
    repoId: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    avgRiskScore: number;
    totalReviews: number;
    totalComments: number;
    trend: number;
    lastReviewAt: number;
  };
  rank: number;
}) {
  const riskConfig = getRiskConfig(entry.avgRiskScore);
  const medalColors: Record<number, string> = {
    1: "text-amber-500",
    2: "text-zinc-400",
    3: "text-orange-600",
  };

  return (
    <Card className="group hover:border-border transition-all">
      <CardContent className="p-5">
        <div className="flex items-center gap-5">
          {/* Rank */}
          <div className="shrink-0 w-10 text-center">
            {rank <= 3 ? (
              <Trophy
                className={cn("size-6 mx-auto", medalColors[rank])}
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground tabular-nums">
                {rank}
              </span>
            )}
          </div>

          {/* Repo info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={entry.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-primary transition-colors truncate"
              >
                {entry.fullName}
              </a>
              <a
                href={entry.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ScanSearch className="size-3.5" />
                {entry.totalReviews} reviews
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5" />
                {entry.totalComments} comments
              </span>
              {entry.trend !== 0 && (
                <span
                  className={cn(
                    "flex items-center gap-1",
                    entry.trend > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {entry.trend > 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {Math.abs(entry.trend)} pts
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-3 rounded-full",
                  riskConfig.barColor,
                )}
              />
              <span className="text-2xl font-semibold tabular-nums">
                {entry.avgRiskScore}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Badge
              variant="outline"
              className={cn("mt-1", riskConfig.badgeClass)}
            >
              {riskConfig.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getRiskConfig(score: number) {
  if (score < 25)
    return {
      label: "Excellent",
      barColor: "bg-emerald-500",
      badgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  if (score < 50)
    return {
      label: "Good",
      barColor: "bg-amber-500",
      badgeClass:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    };
  if (score < 75)
    return {
      label: "Fair",
      barColor: "bg-orange-500",
      badgeClass:
        "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    };
  return {
    label: "Needs Work",
    barColor: "bg-red-500",
    badgeClass:
      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
}
