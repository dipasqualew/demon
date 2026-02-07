import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleFeedback, handleOptions } from "./feedback-endpoint.ts";
import { executeReviewTool } from "./review-tool.ts";
import type { ServerConfig } from "./types.ts";

interface CreateServerOptions {
  config: ServerConfig;
  generateReview: (options: { directory: string; agent?: string; feedbackEndpoint?: string; diffBase?: string }) => Promise<{ htmlPath: string }>;
}

export function createMcpServer(options: CreateServerOptions) {
  const { config, generateReview } = options;

  const server = new McpServer({
    name: "demon-mcp-server",
    version: "0.1.0",
  });

  // Register the review tool
  server.tool(
    "review",
    "Generate a review page for demo files and wait for user feedback. Returns the verdict (approve or request_changes) when the user submits feedback via the web interface.",
    {
      directory: z.string().describe("Path to directory containing demo files (.webm or .jsonl)"),
      agent: z.string().optional().describe("Path to agent manifest for LLM invocation"),
      diffBase: z.string().optional().describe("Base commit/branch for diff (auto-detects main/master if on feature branch)"),
    },
    async ({ directory, agent, diffBase }) => {
      try {
        const result = await executeReviewTool(
          { directory, agent, diffBase },
          config,
          { generateReview }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                verdict: result.verdict,
                feedback: result.feedback,
                htmlPath: result.htmlPath,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error generating review: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

export function createHttpServer(config: ServerConfig) {
  return Bun.serve({
    port: config.port,
    async fetch(req) {
      const url = new URL(req.url);

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        const response = handleOptions();
        return new Response(null, {
          status: response.status,
          headers: response.headers,
        });
      }

      // Handle feedback endpoint
      if (url.pathname === "/feedback" && req.method === "POST") {
        const reviewId = url.searchParams.get("reviewId");
        const body = await req.json();
        const response = await handleFeedback(reviewId, body);
        return new Response(JSON.stringify(response.body), {
          status: response.status,
          headers: response.headers,
        });
      }

      // Health check
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}

export async function runServer(options: CreateServerOptions) {
  const { config } = options;

  // Start HTTP server for feedback endpoint
  const httpServer = createHttpServer(config);
  console.log(`HTTP server listening on port ${config.port}`);

  // Create and connect MCP server via stdio
  const mcpServer = createMcpServer(options);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.log("MCP server connected via stdio");

  return { mcpServer, httpServer };
}
