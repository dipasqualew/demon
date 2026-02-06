export interface DemoStep {
  timestampSeconds: number;
  text: string;
}

export type DemoType = "web-ux" | "log-based";

export interface DemoMetadata {
  file: string;
  type: DemoType;
  summary: string;
  steps: DemoStep[];
}

export interface LogLine {
  lineNumber: number;
  raw: string;
  timestamp?: string;
  level?: string;
  message?: string;
  highlight?: boolean | string;
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

export interface ReviewAppData {
  metadata: ReviewMetadata;
  title: string;
  videos: Record<string, string>;
  logs?: Record<string, string>;
  feedbackEndpoint?: string;
}
