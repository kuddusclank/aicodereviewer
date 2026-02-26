import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import ba from "../../convex/auth";

export const { auth, isAuthenticated } = convexBetterAuthNextJs(ba);
