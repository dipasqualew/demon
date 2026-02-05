export { showCommentary, hideCommentary } from "./commentary.ts";
export type { ShowCommentaryOptions } from "./commentary.ts";

export type { DemoMetadata, ReviewMetadata } from "./review-types.ts";
export { buildReviewPrompt, invokeClaude, parseReviewMetadata } from "./review.ts";
export type { InvokeClaudeOptions, SpawnFn } from "./review.ts";

export { generateReviewHtml } from "./html-generator.ts";
export type { GenerateReviewHtmlOptions } from "./html-generator.ts";
