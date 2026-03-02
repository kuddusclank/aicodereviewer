import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import ba from "./auth";
import { handleGitHubWebhook } from "./webhooks";

const http = httpRouter();

ba.registerRoutes(http);

http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: handleGitHubWebhook,
});

// Badge endpoint: /badge/{owner}/{repo}.svg
http.route({
  pathPrefix: "/badge/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // Extract owner/repo from /badge/owner/repo.svg or /badge/owner/repo
    const pathParts = url.pathname.replace("/badge/", "").replace(".svg", "").split("/");

    if (pathParts.length < 2) {
      return new Response(renderBadge("error", "invalid path", "#e05d44"), {
        status: 400,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-cache",
        },
      });
    }

    const fullName = `${pathParts[0]}/${pathParts[1]}`;

    const data = await ctx.runQuery(internal.leaderboard.getRepoBadgeData, {
      fullName,
    });

    if (!data) {
      return new Response(
        renderBadge("code health", "not found", "#9f9f9f"),
        {
          status: 404,
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "max-age=300",
          },
        },
      );
    }

    const { color, label } = getBadgeStyle(data.avgRiskScore);

    return new Response(
      renderBadge("code health", `${label} ${data.avgRiskScore}/100`, color),
      {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "max-age=300, s-maxage=600",
        },
      },
    );
  }),
});

function getBadgeStyle(score: number): { color: string; label: string } {
  if (score < 25) return { color: "#4c1", label: "excellent" };
  if (score < 50) return { color: "#dfb317", label: "good" };
  if (score < 75) return { color: "#fe7d37", label: "fair" };
  return { color: "#e05d44", label: "needs work" };
}

function renderBadge(left: string, right: string, color: string): string {
  const leftWidth = left.length * 6.5 + 12;
  const rightWidth = right.length * 6.5 + 12;
  const totalWidth = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${left}: ${right}">
  <title>${left}: ${right}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${left}</text>
    <text x="${leftWidth / 2}" y="14">${left}</text>
    <text aria-hidden="true" x="${leftWidth + rightWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${right}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14">${right}</text>
  </g>
</svg>`;
}

export default http;
