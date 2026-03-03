# AI Code Reviewer

A full-stack Next.js app that connects to GitHub repositories and performs AI-powered code reviews on pull requests. Supports multiple AI providers (OpenAI, Google Gemini, Alibaba Qwen), posts reviews directly to GitHub PRs, and features a public code health leaderboard with embeddable badges.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend:** [Convex](https://convex.dev) (real-time database, server functions, scheduling)
- **Auth:** [Better Auth](https://better-auth.com) via `@convex-dev/better-auth` (email/password + GitHub OAuth)
- **AI:** OpenAI, Google Gemini, Alibaba Qwen (multi-provider, OpenAI-compatible SDK)
- **Integrations:** GitHub API, Linear API

## Features

- Connect GitHub repositories via OAuth
- Browse pull requests with stats (additions, deletions, changed files)
- Trigger AI-powered code reviews with model selection
- Real-time review status updates (no polling — powered by Convex reactivity)
- Structured review output: risk score, severity breakdown, actionable comments
- Diff viewer for changed files
- Automatic reviews via GitHub webhooks
- Linear issue linking from PR titles and branch names
- **Auto-post reviews to GitHub** — AI reviews posted as GitHub PR Reviews with inline comments on specific lines
- **Public Code Health Leaderboard** — Repos ranked by average risk score with trend tracking at `/leaderboard`
- **README Badges** — Embeddable shields.io-style SVG badges showing code health scores

## Code Health Badge

Add a live code health badge to your README once your repo is opted in to the public leaderboard:

```markdown
[![Code Health](https://<your-deployment>.convex.site/badge/owner/repo.svg)](https://github.com/owner/repo)
```

The badge updates automatically based on your latest AI review scores. Colors indicate health:
- **Green** — Excellent (risk < 25)
- **Yellow** — Good (risk < 50)
- **Orange** — Fair (risk < 75)
- **Red** — Needs work (risk 75+)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Convex](https://convex.dev) account

### Setup

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Set up Convex:

```bash
npx convex dev
```

This will prompt you to create a Convex project, deploy the schema, and generate types.

3. Set Convex environment variables:

```bash
npx convex env set BETTER_AUTH_SECRET "your-secret"
npx convex env set BETTER_AUTH_URL "http://localhost:3000"
npx convex env set GITHUB_CLIENT_ID "your-github-client-id"
npx convex env set GITHUB_CLIENT_SECRET "your-github-client-secret"
npx convex env set GITHUB_WEBHOOK_SECRET "your-webhook-secret"
npx convex env set OPENAI_API_KEY "your-openai-key"
# Optional:
npx convex env set GEMINI_API_KEY "your-gemini-key"
npx convex env set QWEN_API_KEY "your-qwen-key"
```

4. Create a `.env.local` file:

```env
NEXT_PUBLIC_CONVEX_URL=<your convex deployment url>
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret
BETTER_AUTH_URL=http://localhost:3000
```

5. Run the dev servers (in separate terminals):

```bash
pnpm convex:dev    # Convex backend
pnpm dev           # Next.js frontend
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

### GitHub OAuth Setup

1. Create a GitHub OAuth App at [GitHub Developer Settings](https://github.com/settings/developers)
2. Set the callback URL to `http://localhost:3000/api/auth/callback/github`
3. Add the Client ID and Secret to your Convex environment variables

### GitHub Webhooks

To enable automatic reviews on PR events:

1. In your GitHub repository settings, add a webhook
2. Set the URL to `https://<your-deployment>.convex.site/webhooks/github`
3. Set the content type to `application/json`
4. Set the secret to match your `GITHUB_WEBHOOK_SECRET`
5. Select the "Pull requests" event

## Architecture

```
src/app/                    # Next.js App Router
  ├── (auth)/               # Sign-in, sign-up pages
  ├── (dashboard)/          # Protected pages (repos, reviews)
  ├── leaderboard/          # Public code health leaderboard
  └── api/auth/             # Better Auth handler

convex/                     # Convex backend
  ├── schema.ts             # Database schema
  ├── auth.ts               # Better Auth configuration
  ├── http.ts               # HTTP router (auth, webhooks, badge endpoint)
  ├── repositories.ts       # Repo CRUD + settings (auto-post, public toggle)
  ├── pullRequests.ts       # GitHub PR fetching (actions)
  ├── reviews.ts            # Review management + post-to-GitHub action
  ├── reviewWorker.ts       # Background review processing + auto-post
  ├── leaderboard.ts        # Public leaderboard queries + badge data
  ├── linear.ts             # Linear issue integration
  ├── webhooks.ts           # GitHub webhook handler
  ├── github.ts             # GitHub API helpers (fetch + post reviews)
  └── ai.ts                 # Multi-provider AI pipeline
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm convex:dev` | Start Convex dev server |
| `pnpm convex:deploy` | Deploy Convex to production |

## License

MIT
