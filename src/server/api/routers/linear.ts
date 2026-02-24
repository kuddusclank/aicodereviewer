import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
  extractLinearIssueId,
  fetchLinearIssue,
  getLinearClient,
} from "@/server/services/linear";
import type { LinearIssueInfo } from "@/server/services/linear";

export const linearRouter = createTRPCRouter({
  saveApiKey: protectedProcedure
    .input(z.object({ apiKey: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { linearApiKey: input.apiKey },
      });
      return { success: true };
    }),

  isConnected: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: { linearApiKey: true },
    });
    return { connected: !!user?.linearApiKey };
  }),

  getIssueForPR: protectedProcedure
    .input(
      z.object({
        branchName: z.string(),
        prTitle: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const client = await getLinearClient(ctx.user.id);
      if (!client) return null;

      const identifier = extractLinearIssueId(input.branchName, input.prTitle);
      if (!identifier) return null;

      return fetchLinearIssue(client, identifier);
    }),

  getIssuesForPRs: protectedProcedure
    .input(
      z.object({
        prs: z.array(
          z.object({
            number: z.number(),
            title: z.string(),
            headRef: z.string(),
          }),
        ),
      }),
    )
    .query(async ({ ctx, input }) => {
      const client = await getLinearClient(ctx.user.id);
      if (!client) return {} as Record<number, LinearIssueInfo>;

      // Deduplicate: group PR numbers by their extracted identifier
      const identifierToPrNumbers = new Map<string, number[]>();
      for (const pr of input.prs) {
        const id = extractLinearIssueId(pr.headRef, pr.title);
        if (!id) continue;
        const existing = identifierToPrNumbers.get(id) ?? [];
        existing.push(pr.number);
        identifierToPrNumbers.set(id, existing);
      }

      const result: Record<number, LinearIssueInfo> = {};

      // Fetch each unique identifier once
      const entries = Array.from(identifierToPrNumbers.entries());
      const issues = await Promise.all(
        entries.map(([identifier]) => fetchLinearIssue(client, identifier)),
      );

      for (let i = 0; i < entries.length; i++) {
        const issue = issues[i];
        if (!issue) continue;
        const prNumbers = entries[i][1];
        for (const prNumber of prNumbers) {
          result[prNumber] = issue;
        }
      }

      return result;
    }),
});
