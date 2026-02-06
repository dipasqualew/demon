import { describe, test, expect, beforeEach } from "bun:test";
import {
  createReviewId,
  hasPendingReview,
  resolveFeedback,
  rejectFeedback,
  executeReviewTool,
  getPendingReviewCount,
  clearPendingReviews,
} from "./review-tool.ts";
import type { ServerConfig } from "./types.ts";

describe("review-tool", () => {
  beforeEach(() => {
    clearPendingReviews();
  });

  describe("createReviewId", () => {
    test("generates unique UUIDs", () => {
      const id1 = createReviewId();
      const id2 = createReviewId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe("hasPendingReview", () => {
    test("returns false for non-existent review", () => {
      expect(hasPendingReview("non-existent")).toBe(false);
    });
  });

  describe("resolveFeedback", () => {
    test("returns false for non-existent review", () => {
      expect(resolveFeedback("non-existent", { verdict: "approve" })).toBe(false);
    });
  });

  describe("rejectFeedback", () => {
    test("returns false for non-existent review", () => {
      expect(rejectFeedback("non-existent", new Error("test"))).toBe(false);
    });
  });

  describe("executeReviewTool", () => {
    const config: ServerConfig = {
      port: 3000,
      publicUrl: "http://localhost:3000",
    };

    test("generates review and blocks until feedback", async () => {
      let capturedEndpoint: string | undefined;

      const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
        capturedEndpoint = opts.feedbackEndpoint;
        return { htmlPath: "/tmp/review.html" };
      };

      // Start the review tool (will block)
      const resultPromise = executeReviewTool(
        { directory: "/tmp/demo" },
        config,
        { generateReview: mockGenerateReview }
      );

      // Wait a tick for the promise to be registered
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have a pending review now
      expect(getPendingReviewCount()).toBe(1);
      expect(capturedEndpoint).toMatch(/^http:\/\/localhost:3000\/feedback\?reviewId=/);

      // Extract the reviewId from the endpoint
      const reviewId = new URL(capturedEndpoint!).searchParams.get("reviewId")!;
      expect(hasPendingReview(reviewId)).toBe(true);

      // Resolve the feedback
      resolveFeedback(reviewId, { verdict: "approve" });

      // Now the promise should resolve
      const result = await resultPromise;
      expect(result.verdict).toBe("approve");
      expect(result.htmlPath).toBe("/tmp/review.html");

      // Pending review should be cleared
      expect(getPendingReviewCount()).toBe(0);
    });

    test("includes feedback text for request_changes", async () => {
      let capturedEndpoint: string | undefined;

      const mockGenerateReview = async (opts: { feedbackEndpoint?: string }) => {
        capturedEndpoint = opts.feedbackEndpoint;
        return { htmlPath: "/tmp/review.html" };
      };

      const resultPromise = executeReviewTool(
        { directory: "/tmp/demo" },
        config,
        { generateReview: mockGenerateReview }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(getPendingReviewCount()).toBe(1);

      const reviewId = new URL(capturedEndpoint!).searchParams.get("reviewId")!;
      resolveFeedback(reviewId, { verdict: "request_changes", feedback: "Fix the bug" });

      const result = await resultPromise;
      expect(result.verdict).toBe("request_changes");
      expect(result.feedback).toBe("Fix the bug");
    });

    test("passes agent option to generateReview", async () => {
      let capturedAgent: string | undefined;
      let capturedEndpoint: string | undefined;

      const mockGenerateReview = async (opts: { agent?: string; feedbackEndpoint?: string }) => {
        capturedAgent = opts.agent;
        capturedEndpoint = opts.feedbackEndpoint;
        return { htmlPath: "/tmp/review.html" };
      };

      const resultPromise = executeReviewTool(
        { directory: "/tmp/demo", agent: "/path/to/agent" },
        config,
        { generateReview: mockGenerateReview }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedAgent).toBe("/path/to/agent");

      // Cleanup by resolving the review
      const reviewId = new URL(capturedEndpoint!).searchParams.get("reviewId")!;
      resolveFeedback(reviewId, { verdict: "approve" });
      await resultPromise;
    });
  });
});
