import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getPublicProject } from "./public-project.js";
import { getPublicProfile } from "./public-profile.js";
import { buildPublicProposalReview, validatePublicProposalReviewInput } from "./public-proposal-review.js";
import { checkLocalSubmittedProjects } from "./local-submitted-projects.js";

export function createServer(fetchImpl: typeof fetch = fetch): McpServer {
  const server = new McpServer({ name: "basality-99freelas-mcp", version: "0.1.0" });

  server.registerTool(
    "system_health",
    {
      description: "Report the server's current capabilities. No authentication or account access.",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify({ status: "ok", version: "0.1.0", mode: "public-read-only" }) }],
    }),
  );

  server.registerTool(
    "projects_get_public",
    {
      description: "Read title and public metadata for a 99Freelas project URL. No login, cookies, bids, or messages. Availability may be unknown.",
      inputSchema: z.object({ url: z.url().describe("Public HTTPS 99Freelas project URL") }),
    },
    async ({ url }) => {
      try {
        const project = await getPublicProject(url, fetchImpl);
        return {
          structuredContent: project,
          content: [{ type: "text" as const, text: JSON.stringify(project) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    },
  );

  server.registerTool(
    "proposals_prepare_public_review",
    {
      description: "Read exactly one public 99Freelas project and prepare a human-editable, unsent proposal preview. Scope, question and offer are caller-supplied but not human-confirmed; account eligibility and duplicates remain unverified. No login, bids, or connections.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        url: z.url().describe("Public HTTPS 99Freelas project URL"),
        approach: z.string().trim().min(40).max(1400).describe("Caller-supplied, specific approach that a human must approve; no outside contact links."),
        clarifyingQuestion: z.string().trim().min(15).max(280).describe("One caller-supplied scope question for human review."),
        signature: z.string().trim().max(80).optional(),
        amountBRL: z.number().positive().max(10_000_000).optional(),
        estimatedDays: z.number().int().min(1).max(365).optional(),
      }),
    },
    async (input) => {
      try {
        // Reject invalid links/contact data before performing any external request.
        validatePublicProposalReviewInput(input);
        const project = await getPublicProject(input.url, fetchImpl);
        const localStatus = await checkLocalSubmittedProjects(input.url);
        const preview = buildPublicProposalReview(project, input, localStatus);
        return {
          structuredContent: preview,
          content: [{ type: "text" as const, text: JSON.stringify(preview) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    },
  );

  server.registerTool(
    "profile_get_public",
    {
      description: "Read a 99Freelas freelancer's publicly visible name, title and profile texts. This does not read or modify any account data behind login.",
      inputSchema: z.object({ url: z.url().describe("Public HTTPS 99Freelas /user/ profile URL") }),
    },
    async ({ url }) => {
      try {
        const profile = await getPublicProfile(url, fetchImpl);
        return {
          structuredContent: { ...profile },
          content: [{ type: "text" as const, text: JSON.stringify(profile) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    },
  );

  return server;
}
