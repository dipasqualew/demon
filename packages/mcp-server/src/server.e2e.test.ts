import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { createHttpServer } from "./server.ts";
import { executeReviewTool, clearPendingReviews } from "./review-tool.ts";
import type { ServerConfig } from "./types.ts";

describe("MCP Server E2E", () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let config: ServerConfig;

  beforeAll(() => {
    // Start HTTP server on random port
    httpServer = createHttpServer({ port: 0, publicUrl: "" });
    const actualPort = httpServer.port ?? 3000;
    config = {
      port: actualPort,
      publicUrl: `http://localhost:${actualPort}`,
    };
  });

  afterAll(() => {
    httpServer.stop();
  });

  beforeEach(() => {
    clearPendingReviews();
  });

  test("full flow: tool blocks until feedback POST resolves it", async () => {
    let capturedEndpoint: string | undefined;

    const mockGenerateReview = async (opts: {
      directory: string;
      agent?: string;
      feedbackEndpoint?: string;
    }) => {
      capturedEndpoint = opts.feedbackEndpoint;
      return { htmlPath: `${opts.directory}/review.html` };
    };

    // Start the review tool (will block until feedback)
    const toolResultPromise = executeReviewTool(
      { directory: "/tmp/test-demo" },
      config,
      { generateReview: mockGenerateReview }
    );

    // Wait for generateReview to be called
    await new Promise((r) => setTimeout(r, 50));

    expect(capturedEndpoint).toBeDefined();
    expect(capturedEndpoint).toContain(`http://localhost:${config.port}/feedback?reviewId=`);

    // POST approve feedback via real HTTP
    const response = await fetch(capturedEndpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as { success: boolean };
    expect(responseBody.success).toBe(true);

    // Tool should now resolve
    const result = await toolResultPromise;
    expect(result.verdict).toBe("approve");
    expect(result.htmlPath).toBe("/tmp/test-demo/review.html");
  });

  test("request_changes includes feedback text", async () => {
    let capturedEndpoint: string | undefined;

    const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
      capturedEndpoint = opts.feedbackEndpoint;
      return { htmlPath: "/tmp/review.html" };
    };

    const toolResultPromise = executeReviewTool(
      { directory: "/tmp/demo" },
      config,
      { generateReview: mockGenerateReview }
    );

    await new Promise((r) => setTimeout(r, 50));

    // POST request_changes with feedback
    const response = await fetch(capturedEndpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict: "request_changes",
        feedback: "Please fix the alignment issue",
      }),
    });

    expect(response.status).toBe(200);

    const result = await toolResultPromise;
    expect(result.verdict).toBe("request_changes");
    expect(result.feedback).toBe("Please fix the alignment issue");
  });

  test("CORS preflight works", async () => {
    const response = await fetch(`${config.publicUrl}/feedback?reviewId=test`, {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  test("health endpoint works", async () => {
    const response = await fetch(`${config.publicUrl}/health`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("invalid verdict returns 400", async () => {
    let capturedEndpoint: string | undefined;

    const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
      capturedEndpoint = opts.feedbackEndpoint;
      return { htmlPath: "/tmp/review.html" };
    };

    // Start tool but don't await (it will block)
    executeReviewTool(
      { directory: "/tmp/demo" },
      config,
      { generateReview: mockGenerateReview }
    );

    await new Promise((r) => setTimeout(r, 50));

    // POST invalid verdict
    const response = await fetch(capturedEndpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "maybe" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Invalid payload");

    // Cleanup
    clearPendingReviews();
  });

  test("unknown reviewId returns 404", async () => {
    const response = await fetch(`${config.publicUrl}/feedback?reviewId=unknown-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Review not found or already completed");
  });

  test("missing reviewId returns 400", async () => {
    const response = await fetch(`${config.publicUrl}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Missing reviewId query parameter");
  });

  test("agent option is passed through", async () => {
    let capturedAgent: string | undefined;
    let capturedEndpoint: string | undefined;

    const mockGenerateReview = async (opts: {
      agent?: string;
      feedbackEndpoint?: string;
    }) => {
      capturedAgent = opts.agent;
      capturedEndpoint = opts.feedbackEndpoint;
      return { htmlPath: "/tmp/review.html" };
    };

    const toolResultPromise = executeReviewTool(
      { directory: "/tmp/demo", agent: "/path/to/agent.json" },
      config,
      { generateReview: mockGenerateReview }
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(capturedAgent).toBe("/path/to/agent.json");

    // Complete the review
    await fetch(capturedEndpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "approve" }),
    });

    await toolResultPromise;
  });
});
