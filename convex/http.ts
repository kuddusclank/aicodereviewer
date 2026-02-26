import { httpRouter } from "convex/server";
import ba from "./auth";
import { handleGitHubWebhook } from "./webhooks";

const http = httpRouter();

ba.registerRoutes(http);

http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: handleGitHubWebhook,
});

export default http;
