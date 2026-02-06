export type DemoType = "web-ux" | "log-based";

export interface DemoMetadata {
  file: string;
  type: DemoType;
  summary: string;
  steps: Array<{ timestampSeconds: number; text: string }>;
}

export type IssueSeverity = "major" | "minor" | "nit";

export interface ReviewIssue {
  severity: IssueSeverity;
  description: string;
}

export type ReviewVerdict = "approve" | "request_changes";

export interface CodeReview {
  summary: string;
  highlights: string[];
  verdict: ReviewVerdict;
  verdictReason: string;
  issues: ReviewIssue[];
}

export interface ReviewMetadata {
  demos: DemoMetadata[];
  review?: CodeReview;
}
