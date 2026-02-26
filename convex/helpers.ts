import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import ba from "./auth";

export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx | ActionCtx,
) {
  const session = await ba.getSession(ctx);
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

/**
 * Get the GitHub access token for a user from Better Auth's account table.
 */
export async function getGitHubAccessToken(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  userId: string,
): Promise<string | null> {
  const accounts = await ba.listAccounts(ctx, userId);
  const github = accounts.find(
    (a: { providerId: string }) => a.providerId === "github",
  );
  return github?.accessToken ?? null;
}
