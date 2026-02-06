export interface DemoStep {
  timestampSeconds: number;
  text: string;
}

export interface DemoMetadata {
  file: string;
  summary: string;
  steps: DemoStep[];
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
}
