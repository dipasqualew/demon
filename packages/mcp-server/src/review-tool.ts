import { randomUUID } from "node:crypto";
import type { FeedbackPayload, PendingReview, ReviewToolInput, ReviewToolResult, ServerConfig } from "./types.ts";

// Store pending reviews waiting for feedback
const pendingReviews = new Map<string, PendingReview>();

export function createReviewId(): string {
  return randomUUID();
}

export function getPendingReview(reviewId: string): PendingReview | undefined {
  return pendingReviews.get(reviewId);
}

export function hasPendingReview(reviewId: string): boolean {
  return pendingReviews.has(reviewId);
}

export function resolveFeedback(reviewId: string, payload: FeedbackPayload): boolean {
  const pending = pendingReviews.get(reviewId);
  if (!pending) {
    return false;
  }

  pending.resolve(payload);
  pendingReviews.delete(reviewId);
  return true;
}

export function rejectFeedback(reviewId: string, error: Error): boolean {
  const pending = pendingReviews.get(reviewId);
  if (!pending) {
    return false;
  }

  pending.reject(error);
  pendingReviews.delete(reviewId);
  return true;
}

interface ReviewToolDeps {
  generateReview: (options: { directory: string; agent?: string; feedbackEndpoint?: string }) => Promise<{ htmlPath: string }>;
}

export async function executeReviewTool(
  input: ReviewToolInput,
  config: ServerConfig,
  deps: ReviewToolDeps
): Promise<ReviewToolResult> {
  const reviewId = createReviewId();
  const feedbackEndpoint = `${config.publicUrl}/feedback?reviewId=${reviewId}`;

  // Generate the review HTML with the feedback endpoint embedded
  const { htmlPath } = await deps.generateReview({
    directory: input.directory,
    agent: input.agent,
    feedbackEndpoint,
  });

  // Create a promise that will be resolved when feedback is received
  const feedbackPromise = new Promise<FeedbackPayload>((resolve, reject) => {
    pendingReviews.set(reviewId, { resolve, reject });
  });

  console.log(`Review generated: ${htmlPath}`);
  console.log(`Waiting for feedback at: ${feedbackEndpoint}`);

  // Block until feedback is received
  const feedback = await feedbackPromise;

  return {
    verdict: feedback.verdict,
    feedback: feedback.feedback,
    htmlPath,
  };
}

// For testing: get count of pending reviews
export function getPendingReviewCount(): number {
  return pendingReviews.size;
}

// For testing: clear all pending reviews
export function clearPendingReviews(): void {
  pendingReviews.clear();
}
