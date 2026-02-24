# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Code Reviewer — a Next.js full-stack app that connects to GitHub repositories and performs AI-powered code reviews on pull requests using OpenAI (GPT-4o-mini). Uses tRPC for type-safe APIs, Better Auth for authentication, Inngest for background job processing, and Prisma with PostgreSQL.

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm db:push          # Push Prisma schema to database (not migrate)
pnpm db:generate      # Generate Prisma client types (run after schema changes)
```

## Architecture

**App Router layout** (`src/app/`):
- `/(auth)` — sign-in, sign-up pages (public)
- `/(dashboard)` — protected pages with auth guard in layout.tsx: repos, reviews
- `/api/auth/[...all]` — Better Auth handler
- `/api/trpc/[trpc]` — tRPC endpoint
- `/api/webhooks/github` — GitHub webhook receiver (verifies HMAC-SHA256 signature)
- `/api/inngest` — Inngest serve endpoint

**Server layer** (`src/server/`):
- `api/trpc.ts` — tRPC context, middleware, public/protected procedure definitions
- `api/routers/` — tRPC routers: `repository`, `pull-request`, `review`
- `api/root.ts` — aggregates routers into `appRouter`
- `auth/index.ts` — Better Auth config (email/password + GitHub OAuth with `repo` scope)
- `db/index.ts` — Prisma client singleton
- `services/github.ts` — GitHub API integration (repos, PRs, file diffs)
- `services/ai.ts` — OpenAI review pipeline with Zod-validated structured output
- `inngest/` — background job definitions (PR review processing)

**Client layer** (`src/`):
- `lib/trpc/` — tRPC client + React Query provider
- `lib/auth-client.ts` — Better Auth client hooks
- `components/ui/` — shadcn components (new-york style, Tailwind v4)

## Key Patterns

- **tRPC protected procedures** check session via Better Auth middleware; throw UNAUTHORIZED if no session. User context is available in all protected procedures.
- **AI review pipeline**: GitHub webhook → create Review record (PENDING) → Inngest event → fetch PR files → call `reviewCode()` → save structured result (summary, riskScore 0-100, comments with severity/category). Review statuses: PENDING → PROCESSING → COMPLETED/FAILED.
- **GitHub OAuth tokens** are stored in the `Account` model and retrieved via `getGitHubAccessToken(userId)` for API calls.
- **SuperJSON** is the tRPC transformer for serializing dates and other complex types.
- **TypeScript build errors are ignored** in `next.config.ts` (`ignoreBuildErrors: true`).
- Path alias: `@/*` maps to `./src/*`.

## Database

Prisma schema at `prisma/schema.prisma`. Key models: User, Session, Account, Verification (auth), Repository, Review (app). Use `pnpm db:push` to sync schema — this project does not use Prisma migrate.

## Environment Variables

See `.env.example`. Required: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
