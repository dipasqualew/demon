import { describe, test, expect, beforeEach } from "bun:test";
import { handleFeedback, handleOptions } from "./feedback-endpoint.ts";
import { clearPendingReviews, executeReviewTool } from "./review-tool.ts";
import type { ServerConfig } from "./types.ts";

describe("feedback-endpoint", () => {
  beforeEach(() => {
    clearPendingReviews();
  });

  describe("handleOptions", () => {
    test("returns CORS headers", () => {
      const response = handleOptions();

      expect(response.status).toBe(204);
      expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(response.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
      expect(response.headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
    });
  });

  describe("handleFeedback", () => {
    test("returns 400 when reviewId is missing", async () => {
      const response = await handleFeedback(null, { verdict: "approve" });

      expect(response.status).toBe(400);
      expect(response.body["error"]).toBe("Missing reviewId query parameter");
    });

    test("returns 404 when review not found", async () => {
      const response = await handleFeedback("non-existent", { verdict: "approve" });

      expect(response.status).toBe(404);
      expect(response.body["error"]).toBe("Review not found or already completed");
    });

    test("returns 400 when verdict is invalid", async () => {
      // Create a pending review
      const config: ServerConfig = { port: 3000, publicUrl: "http://localhost:3000" };
      let reviewId: string | undefined;

      const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
        reviewId = new URL(opts.feedbackEndpoint!).searchParams.get("reviewId")!;
        return { htmlPath: "/tmp/review.html" };
      };

      // Start review (will block)
      executeReviewTool({ directory: "/tmp" }, config, { generateReview: mockGenerateReview });
      await new Promise((r) => setTimeout(r, 10));

      const response = await handleFeedback(reviewId!, { verdict: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body["error"]).toBe("Invalid payload");

      clearPendingReviews();
    });

    test("returns 200 and resolves review on valid approve", async () => {
      const config: ServerConfig = { port: 3000, publicUrl: "http://localhost:3000" };
      let reviewId: string | undefined;

      const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
        reviewId = new URL(opts.feedbackEndpoint!).searchParams.get("reviewId")!;
        return { htmlPath: "/tmp/review.html" };
      };

      // Start review
      const resultPromise = executeReviewTool(
        { directory: "/tmp" },
        config,
        { generateReview: mockGenerateReview }
      );
      await new Promise((r) => setTimeout(r, 10));

      // Submit feedback
      const response = await handleFeedback(reviewId!, { verdict: "approve" });

      expect(response.status).toBe(200);
      expect(response.body["success"]).toBe(true);
      expect(response.body["verdict"]).toBe("approve");

      // The review should resolve
      const result = await resultPromise;
      expect(result.verdict).toBe("approve");
    });

    test("returns 200 and includes feedback for request_changes", async () => {
      const config: ServerConfig = { port: 3000, publicUrl: "http://localhost:3000" };
      let reviewId: string | undefined;

      const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
        reviewId = new URL(opts.feedbackEndpoint!).searchParams.get("reviewId")!;
        return { htmlPath: "/tmp/review.html" };
      };

      const resultPromise = executeReviewTool(
        { directory: "/tmp" },
        config,
        { generateReview: mockGenerateReview }
      );
      await new Promise((r) => setTimeout(r, 10));

      const response = await handleFeedback(reviewId!, {
        verdict: "request_changes",
        feedback: "Please fix the bug",
      });

      expect(response.status).toBe(200);
      expect(response.body["success"]).toBe(true);

      const result = await resultPromise;
      expect(result.verdict).toBe("request_changes");
      expect(result.feedback).toBe("Please fix the bug");
    });

    test("includes CORS headers in response", async () => {
      const response = await handleFeedback("test", { verdict: "approve" });

      expect(response.headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(response.headers["Content-Type"]).toBe("application/json");
    });
  });
});
