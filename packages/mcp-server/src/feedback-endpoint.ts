import { z } from "zod";
import { hasPendingReview, resolveFeedback } from "./review-tool.ts";
import type { FeedbackPayload } from "./types.ts";

const FeedbackPayloadSchema = z.object({
  verdict: z.enum(["approve", "request_changes"]),
  feedback: z.string().optional(),
});

export interface FeedbackResponse {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function handleOptions(): FeedbackResponse {
  return {
    status: 204,
    body: {},
    headers: CORS_HEADERS,
  };
}

export async function handleFeedback(
  reviewId: string | null,
  body: unknown
): Promise<FeedbackResponse> {
  const headers = {
    "Content-Type": "application/json",
    ...CORS_HEADERS,
  };

  if (!reviewId) {
    return {
      status: 400,
      body: { error: "Missing reviewId query parameter" },
      headers,
    };
  }

  if (!hasPendingReview(reviewId)) {
    return {
      status: 404,
      body: { error: "Review not found or already completed" },
      headers,
    };
  }

  const parseResult = FeedbackPayloadSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      status: 400,
      body: { error: "Invalid payload", details: parseResult.error.issues },
      headers,
    };
  }

  const payload: FeedbackPayload = parseResult.data;
  resolveFeedback(reviewId, payload);

  return {
    status: 200,
    body: { success: true, verdict: payload.verdict },
    headers,
  };
}
