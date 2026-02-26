import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client";

const authBaseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  plugins: [convexClient()],
});

export const { signIn, signUp, signOut, useSession, getSession, linkSocial } =
  authClient;
