"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitPullRequest,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

type ReviewStatus = "all" | "COMPLETED" | "PROCESSING" | "PENDING" | "FAILED";

export default function ReviewsPage() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>("all");
  const [isRetrying, setIsRetrying] = useState(false);

  const convex = useConvex();

  // Convex query is reactive — auto-updates when reviews change. No polling needed!
  const reviews = useQuery(api.reviews.list, { limit: 50 });

  const handleRetry = async (
    repositoryId: Id<"repositories">,
    prNumber: number,
  ) => {
    setIsRetrying(true);
    try {
      await convex.action(api.reviews.trigger, {
        repositoryId,
        prNumber,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const filteredReviews = reviews?.filter(
    (r) => statusFilter === "all" || r.status === statusFilter,
  );

  const statusCounts = {
    all: reviews?.length ?? 0,
    COMPLETED:
      reviews?.filter((r) => r.status === "COMPLETED").length ?? 0,
    PROCESSING:
      reviews?.filter((r) => r.status === "PROCESSING").length ?? 0,
    PENDING: reviews?.filter((r) => r.status === "PENDING").length ?? 0,
    FAILED: reviews?.filter((r) => r.status === "FAILED").length ?? 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground mt-1">
            {statusCounts.all} total reviews
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap p-1 bg-muted/50 rounded-lg w-fit">
        {(["all", "COMPLETED", "PROCESSING", "PENDING", "FAILED"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                statusFilter === status
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <StatusIcon status={status} className="size-3.5" />
              {status === "all"
                ? "All"
                : status.charAt(0) + status.slice(1).toLowerCase()}
              <span
                className={cn(
                  "ml-1 text-xs tabular-nums",
                  statusFilter === status
                    ? "text-muted-foreground"
                    : "text-muted-foreground/70",
                )}
              >
                {statusCounts[status]}
              </span>
            </button>
          ),
        )}
      </div>

      {reviews === undefined ? (
        <div>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredReviews?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 font-medium">
              {statusFilter === "all"
                ? "No reviews yet"
                : `No ${statusFilter.toLowerCase()} reviews`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === "all" &&
                "Run your first AI review on a pull request!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReviews?.map((review) => (
            <ReviewCard
              key={review._id}
              review={review}
              onRetry={
                review.status === "FAILED" && review.repository
                  ? () =>
                      handleRetry(
                        review.repository!._id,
                        review.prNumber,
                      )
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewCardProps {
  review: {
    _id: Id<"reviews">;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    status: string;
    summary?: string;
    riskScore?: number;
    comments: unknown;
    error?: string;
    _creationTime: number;
    repository: {
      _id: Id<"repositories">;
      fullName: string;
    } | null;
  };
  onRetry?: () => void;
}

function ReviewCard({ review, onRetry }: ReviewCardProps) {
  const commentCount = Array.isArray(review.comments)
    ? review.comments.length
    : 0;

  const getStatusMessage = () => {
    switch (review.status) {
      case "PENDING":
        return "Queued — will start shortly";
      case "PROCESSING":
        return "Analyzing code…";
      case "FAILED":
        return review.error || "Analysis failed";
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <Card className="group hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div
              className={cn(
                "mt-1 p-2 rounded-lg shrink-0",
                getStatusBg(review.status),
              )}
            >
              <StatusIcon status={review.status} className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {review.repository && (
                  <Link
                    href={`/repos/${review.repository._id}/pr/${review.prNumber}`}
                    className="font-medium hover:text-primary transition-colors truncate"
                  >
                    {review.prTitle}
                  </Link>
                )}
                <StatusBadge status={review.status} />
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium">
                  {review.repository?.fullName ?? "Unknown"}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span>#{review.prNumber}</span>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(review._creationTime)}
                </span>
              </div>
              {review.status === "COMPLETED" && (
                <div className="flex items-center gap-4 pt-1">
                  {review.riskScore !== undefined && (
                    <RiskScoreBadge score={review.riskScore} />
                  )}
                  {commentCount > 0 && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <AlertTriangle className="size-3.5" />
                      {commentCount}{" "}
                      {commentCount === 1 ? "comment" : "comments"}
                    </span>
                  )}
                </div>
              )}
              {review.summary && review.status === "COMPLETED" && (
                <p className="text-sm text-muted-foreground line-clamp-2 pt-1">
                  {review.summary}
                </p>
              )}
              {statusMessage && review.status !== "COMPLETED" && (
                <p
                  className={cn(
                    "text-sm pt-1",
                    review.status === "FAILED"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  {statusMessage}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={review.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              <ExternalLink className="size-4" />
            </a>
            {review.status === "FAILED" && onRetry ? (
              <Button onClick={onRetry}>Retry</Button>
            ) : review.repository ? (
              <Link
                href={`/repos/${review.repository._id}/pr/${review.prNumber}`}
              >
                <Button size={"sm"} variant={"outline"}>
                  {review.status === "COMPLETED" ? "Completed" : "Pending"}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusBg(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/10";
    case "PROCESSING":
      return "bg-blue-500/10";
    case "PENDING":
      return "bg-amber-500/10";
    case "FAILED":
      return "bg-red-500/10";
    default:
      return "bg-muted";
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "success" | "info" | "warning" | "destructive"
  > = {
    COMPLETED: "success",
    PROCESSING: "info",
    PENDING: "warning",
    FAILED: "destructive",
  };

  return (
    <Badge variant={variants[status] || "secondary"}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function StatusIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  switch (status) {
    case "COMPLETED":
      return (
        <CheckCircle
          className={cn("text-emerald-600 dark:text-emerald-400", className)}
        />
      );
    case "PROCESSING":
      return (
        <Loader2
          className={cn(
            "text-blue-600 dark:text-blue-400 animate-spin",
            className,
          )}
        />
      );
    case "PENDING":
      return (
        <Clock
          className={cn("text-amber-600 dark:text-amber-400", className)}
        />
      );
    case "FAILED":
      return (
        <XCircle className={cn("text-red-600 dark:text-red-400", className)} />
      );
    default:
      return (
        <GitPullRequest className={cn("text-muted-foreground", className)} />
      );
  }
}

function RiskScoreBadge({ score }: { score: number }) {
  const config = getRiskConfig(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        config.textColor,
      )}
    >
      <span className={cn("w-2 h-2 rounded-full", config.barColor)} />
      {config.label}
      <span className="text-muted-foreground font-normal tabular-nums">
        {score}
      </span>
    </span>
  );
}

function getRiskConfig(score: number) {
  if (score < 25)
    return {
      label: "Low",
      textColor: "text-emerald-600 dark:text-emerald-400",
      barColor: "bg-emerald-500",
    };
  if (score < 50)
    return {
      label: "Medium",
      textColor: "text-amber-600 dark:text-amber-400",
      barColor: "bg-amber-500",
    };
  if (score < 75)
    return {
      label: "High",
      textColor: "text-orange-600 dark:text-orange-400",
      barColor: "bg-orange-500",
    };
  return {
    label: "Critical",
    textColor: "text-red-600 dark:text-red-400",
    barColor: "bg-red-500",
  };
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
