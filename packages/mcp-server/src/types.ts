export type ReviewVerdict = "approve" | "request_changes";

export interface FeedbackPayload {
  verdict: ReviewVerdict;
  feedback?: string;
}

export interface PendingReview {
  resolve: (payload: FeedbackPayload) => void;
  reject: (error: Error) => void;
}

export interface ReviewToolInput {
  directory: string;
  agent?: string;
  diffBase?: string;  // Base commit/branch for diff (auto-detected if not provided)
}

export interface ReviewToolResult {
  verdict: ReviewVerdict;
  feedback?: string;
  htmlPath: string;
}

export interface ServerConfig {
  port: number;
  publicUrl: string;
}
