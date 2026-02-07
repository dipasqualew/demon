import { getLogger } from "./logger.ts";

export type SpawnFn = (
  cmd: string[],
) => { exitCode: Promise<number>; stdout: ReadableStream<Uint8Array> };

export interface InvokeClaudeOptions {
  agent?: string;
  spawn?: SpawnFn;
}

const GIT_DIFF_MAX_CHARS = 50_000;

export interface BuildReviewPromptOptions {
  filenames: string[];
  stepsMap: Record<string, Array<{ text: string; timestampSeconds: number }>>;
  gitDiff?: string;
  guidelines?: string[];
}

export function buildReviewPrompt(options: BuildReviewPromptOptions): string {
  const { filenames, stepsMap, gitDiff, guidelines } = options;

  const demoEntries = filenames.map((f) => {
    const steps = stepsMap[f] ?? [];
    const stepLines = steps
      .map((s) => `- [${s.timestampSeconds}s] ${s.text}`)
      .join("\n");
    return `Video: ${f}\nRecorded steps:\n${stepLines || "(no steps recorded)"}`;
  });

  const sections: string[] = [];

  if (guidelines && guidelines.length > 0) {
    sections.push(`## Coding Guidelines\n\n${guidelines.join("\n\n")}`);
  }

  if (gitDiff) {
    let diff = gitDiff;
    if (diff.length > GIT_DIFF_MAX_CHARS) {
      diff = diff.slice(0, GIT_DIFF_MAX_CHARS) + "\n\n... (diff truncated at 50k characters)";
    }
    sections.push(`## Git Diff\n\n\`\`\`diff\n${diff}\n\`\`\``);
  }

  sections.push(`## Demo Recordings\n\n${demoEntries.join("\n\n")}`);

  return `You are a code reviewer. You are given a git diff, coding guidelines, and demo recordings that show the feature in action.

${sections.join("\n\n")}

## Task

Review the code changes and demo recordings. Generate a JSON object matching this exact schema:

{
  "demos": [
    {
      "file": "<filename>",
      "summary": "<a meaningful sentence describing what this demo showcases based on the steps>"
    }
  ],
  "review": {
    "summary": "<2-3 sentence overview of the changes>",
    "highlights": ["<positive aspect 1>", "<positive aspect 2>"],
    "verdict": "approve" | "request_changes",
    "verdictReason": "<one sentence justifying the verdict>",
    "issues": [
      {
        "severity": "major" | "minor" | "nit",
        "description": "<what the issue is and how to fix it>"
      }
    ]
  }
}

Rules:
- Return ONLY the JSON object, no markdown fences or extra text.
- Include one entry in "demos" for each filename, in the same order.
- "file" must exactly match the provided filename.
- "verdict" must be exactly "approve" or "request_changes".
- Use "request_changes" if there are any "major" issues.
- "severity" must be exactly "major", "minor", or "nit".
- "major": bugs, security issues, broken functionality, guideline violations.
- "minor": code quality, readability, missing edge cases.
- "nit": style, naming, trivial improvements.
- "highlights" must have at least one entry.
- "issues" can be an empty array if there are no issues.
- Verify that demo steps demonstrate the acceptance criteria being met.`;
}

export async function invokeClaude(
  prompt: string,
  options?: InvokeClaudeOptions,
): Promise<string> {
  const logger = getLogger();
  const spawnFn = options?.spawn ?? defaultSpawn;
  const agent = options?.agent ?? "claude";

  logger.debug("Invoking Claude", { agent, promptLength: prompt.length });
  const proc = spawnFn([agent, "-p", prompt]);

  const reader = proc.stdout.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalBytes += value.length;
    logger.debug("Received chunk from Claude", { chunkSize: value.length, totalBytes });
  }

  const exitCode = await proc.exitCode;
  logger.debug("Claude process exited", { exitCode, totalBytes });

  const output = new TextDecoder().decode(
    concatUint8Arrays(chunks),
  );

  if (exitCode !== 0) {
    logger.error("Claude process failed", { exitCode, output: output.slice(0, 500) });
    throw new Error(
      `claude process exited with code ${exitCode}: ${output.trim()}`,
    );
  }

  logger.debug("Claude invocation successful", { outputLength: output.trim().length });
  return output.trim();
}

import type { IssueSeverity, ReviewVerdict } from "./review-types.ts";

export interface LlmReviewResponse {
  demos: Array<{ file: string; summary: string }>;
  review: {
    summary: string;
    highlights: string[];
    verdict: ReviewVerdict;
    verdictReason: string;
    issues: Array<{ severity: IssueSeverity; description: string }>;
  };
}

const VALID_VERDICTS: ReadonlySet<string> = new Set(["approve", "request_changes"]);
const VALID_SEVERITIES: ReadonlySet<string> = new Set(["major", "minor", "nit"]);

export function extractJson(raw: string): string {
  const logger = getLogger();
  logger.debug("Extracting JSON from raw output", { rawLength: raw.length });

  // Try raw string first
  try {
    JSON.parse(raw);
    logger.debug("Raw output is valid JSON");
    return raw;
  } catch {
    logger.debug("Raw output is not valid JSON, searching for JSON object");
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    logger.error("No JSON object found in LLM response", { rawPreview: raw.slice(0, 200), start, end });
    throw new Error(`No JSON object found in LLM response: ${raw.slice(0, 200)}`);
  }

  logger.debug("JSON object found", { start, end, extractedLength: end - start + 1 });
  return raw.slice(start, end + 1);
}

export function parseLlmResponse(raw: string): LlmReviewResponse {
  const logger = getLogger();
  logger.debug("Parsing LLM response", { rawLength: raw.length });

  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
    logger.debug("JSON parsed successfully");
  } catch (err) {
    logger.error("Failed to parse JSON from LLM", { jsonPreview: raw.slice(0, 200), error: err instanceof Error ? err.message : String(err) });
    throw new Error(`Invalid JSON from LLM: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== "object" || parsed === null || !("demos" in parsed)) {
    logger.error("Missing 'demos' array in review metadata", { parsed });
    throw new Error("Missing 'demos' array in review metadata");
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj["demos"])) {
    logger.error("'demos' is not an array", { demosType: typeof obj["demos"] });
    throw new Error("'demos' must be an array");
  }

  logger.debug("Validating demos array", { demosCount: (obj["demos"] as unknown[]).length });
  for (const demo of obj["demos"] as unknown[]) {
    if (typeof demo !== "object" || demo === null) {
      logger.error("Invalid demo object", { demo });
      throw new Error("Each demo must be an object");
    }
    const d = demo as Record<string, unknown>;

    if (typeof d["file"] !== "string") {
      logger.error("Demo missing 'file' string", { demo: d });
      throw new Error("Each demo must have a 'file' string");
    }
    if (typeof d["summary"] !== "string") {
      logger.error("Demo missing 'summary' string", { demo: d });
      throw new Error("Each demo must have a 'summary' string");
    }
  }

  if (typeof obj["review"] !== "object" || obj["review"] === null) {
    logger.error("Missing 'review' object in response");
    throw new Error("Missing 'review' object in response");
  }

  const review = obj["review"] as Record<string, unknown>;
  logger.debug("Validating review object", { reviewKeys: Object.keys(review) });

  if (typeof review["summary"] !== "string") {
    logger.error("review.summary is not a string", { summaryType: typeof review["summary"] });
    throw new Error("review.summary must be a string");
  }

  if (!Array.isArray(review["highlights"])) {
    logger.error("review.highlights is not an array", { highlightsType: typeof review["highlights"] });
    throw new Error("review.highlights must be an array");
  }
  if (review["highlights"].length === 0) {
    logger.error("review.highlights is empty");
    throw new Error("review.highlights must not be empty");
  }
  for (const h of review["highlights"]) {
    if (typeof h !== "string") {
      logger.error("Highlight is not a string", { highlightType: typeof h });
      throw new Error("Each highlight must be a string");
    }
  }

  if (typeof review["verdict"] !== "string" || !VALID_VERDICTS.has(review["verdict"])) {
    logger.error("Invalid review.verdict", { verdict: review["verdict"] });
    throw new Error("review.verdict must be 'approve' or 'request_changes'");
  }

  if (typeof review["verdictReason"] !== "string") {
    logger.error("review.verdictReason is not a string", { verdictReasonType: typeof review["verdictReason"] });
    throw new Error("review.verdictReason must be a string");
  }

  if (!Array.isArray(review["issues"])) {
    logger.error("review.issues is not an array", { issuesType: typeof review["issues"] });
    throw new Error("review.issues must be an array");
  }

  logger.debug("Validating issues array", { issuesCount: (review["issues"] as unknown[]).length });
  for (const issue of review["issues"] as unknown[]) {
    if (typeof issue !== "object" || issue === null) {
      logger.error("Invalid issue object", { issue });
      throw new Error("Each issue must be an object");
    }
    const i = issue as Record<string, unknown>;
    if (typeof i["severity"] !== "string" || !VALID_SEVERITIES.has(i["severity"])) {
      logger.error("Invalid issue severity", { severity: i["severity"] });
      throw new Error("Each issue severity must be 'major', 'minor', or 'nit'");
    }
    if (typeof i["description"] !== "string") {
      logger.error("Issue missing 'description' string", { issue: i });
      throw new Error("Each issue must have a 'description' string");
    }
  }

  logger.debug("LLM response parsed and validated successfully", {
    demosCount: (obj["demos"] as unknown[]).length,
    verdict: review["verdict"],
    highlightsCount: (review["highlights"] as unknown[]).length,
    issuesCount: (review["issues"] as unknown[]).length,
  });

  return parsed as LlmReviewResponse;
}

import { spawn } from "node:child_process";
import { Readable } from "node:stream";

function defaultSpawn(
  cmd: string[],
): { exitCode: Promise<number>; stdout: ReadableStream<Uint8Array> } {
  const [command, ...args] = cmd;
  const proc = spawn(command!, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const exitCode = new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  const stdout = Readable.toWeb(proc.stdout!) as unknown as ReadableStream<Uint8Array>;

  return { exitCode, stdout };
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}
