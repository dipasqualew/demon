import { randomUUID } from "node:crypto";

import { getLogger } from "./logger.ts";

export type ReviewVerdict = "approve" | "request_changes";

export interface FeedbackPayload {
  verdict: ReviewVerdict;
  feedback?: string;
}

interface PendingReview {
  resolve: (payload: FeedbackPayload) => void;
  reject: (error: Error) => void;
}

const pendingReviews = new Map<string, PendingReview>();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidPayload(body: unknown): body is FeedbackPayload {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  if (obj["verdict"] !== "approve" && obj["verdict"] !== "request_changes") return false;
  if (obj["feedback"] !== undefined && typeof obj["feedback"] !== "string") return false;
  return true;
}

export interface FeedbackServerResult {
  server: ReturnType<typeof Bun.serve>;
  port: number;
  reviewId: string;
  feedbackEndpoint: string;
  waitForFeedback: () => Promise<FeedbackPayload>;
  stop: () => void;
}

export function startFeedbackServer(preferredPort = 0): FeedbackServerResult {
  const logger = getLogger();
  const reviewId = randomUUID();

  logger.debug("Starting feedback server", { preferredPort, reviewId });

  const server = Bun.serve({
    port: preferredPort,
    async fetch(req) {
      const url = new URL(req.url);
      logger.debug("Incoming request", { method: req.method, pathname: url.pathname, search: url.search });

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        logger.debug("Handling CORS preflight");
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      }

      // Handle feedback endpoint
      if (url.pathname === "/feedback" && req.method === "POST") {
        const requestReviewId = url.searchParams.get("reviewId");
        const headers = {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        };

        logger.debug("Handling feedback request", { requestReviewId });

        if (!requestReviewId) {
          logger.warn("Missing reviewId query parameter");
          return new Response(
            JSON.stringify({ error: "Missing reviewId query parameter" }),
            { status: 400, headers }
          );
        }

        const pending = pendingReviews.get(requestReviewId);
        if (!pending) {
          logger.warn("Review not found or already completed", { requestReviewId });
          return new Response(
            JSON.stringify({ error: "Review not found or already completed" }),
            { status: 404, headers }
          );
        }

        let body: unknown;
        try {
          body = await req.json();
          logger.debug("Request body parsed", { body });
        } catch (err) {
          logger.warn("Invalid JSON in request body", { error: err instanceof Error ? err.message : String(err) });
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers }
          );
        }

        if (!isValidPayload(body)) {
          logger.warn("Invalid payload", { body });
          return new Response(
            JSON.stringify({ error: "Invalid payload" }),
            { status: 400, headers }
          );
        }

        logger.debug("Valid feedback received", { verdict: body.verdict, hasFeedback: !!body.feedback });
        pending.resolve(body);
        pendingReviews.delete(requestReviewId);

        logger.debug("Feedback processed successfully", { verdict: body.verdict });
        return new Response(
          JSON.stringify({ success: true, verdict: body.verdict }),
          { status: 200, headers }
        );
      }

      // Health check
      if (url.pathname === "/health") {
        logger.debug("Health check request");
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      logger.debug("Not found", { pathname: url.pathname });
      return new Response("Not Found", { status: 404 });
    },
  });

  const port = server.port ?? 3000;
  const feedbackEndpoint = `http://localhost:${port}/feedback?reviewId=${reviewId}`;

  logger.debug("Feedback server started", { port, reviewId, feedbackEndpoint });

  const feedbackPromise = new Promise<FeedbackPayload>((resolve, reject) => {
    pendingReviews.set(reviewId, { resolve, reject });
  });

  return {
    server,
    port,
    reviewId,
    feedbackEndpoint,
    waitForFeedback: () => feedbackPromise,
    stop: () => {
      logger.debug("Stopping feedback server", { reviewId });
      const pending = pendingReviews.get(reviewId);
      if (pending) {
        pending.reject(new Error("Server stopped"));
        pendingReviews.delete(reviewId);
      }
      server.stop();
      logger.debug("Feedback server stopped");
    },
  };
}
