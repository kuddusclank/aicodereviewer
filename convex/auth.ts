import { BetterAuth } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { components } from "./_generated/api";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
].filter((v): v is string => Boolean(v));

if (trustedOrigins.length === 0) {
  throw new Error("Missing BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL");
}

const ba = new BetterAuth(components.betterAuth, {
  betterAuth: betterAuth({
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: requireEnv("GITHUB_CLIENT_ID"),
        clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
        scope: ["read:user", "user:email", "repo"],
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["github"],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    trustedOrigins,
  }),
});

export default ba;
