export { showCommentary, hideCommentary } from "./commentary.ts";
export type { ShowCommentaryOptions } from "./commentary.ts";

export type { DemoMetadata, ReviewMetadata, IssueSeverity, ReviewIssue, ReviewVerdict, CodeReview } from "./review-types.ts";
export { buildReviewPrompt, extractJson, invokeClaude, parseLlmResponse } from "./review.ts";
export type { InvokeClaudeOptions, SpawnFn, LlmReviewResponse, BuildReviewPromptOptions } from "./review.ts";

export { getRepoContext } from "./git-context.ts";
export type { ExecFn, ReadFileFn, RepoContext, GetRepoContextOptions } from "./git-context.ts";

export { DemoRecorder } from "./recorder.ts";
export type { DemoStep } from "./recorder.ts";

export { generateReview, discoverDemoFiles, generateReviewHtml, getReviewTemplate, videoToDataUri } from "./review-generator.ts";
export type { GenerateReviewOptions, GenerateReviewResult, ReviewAppData, DemoFile } from "./review-generator.ts";
