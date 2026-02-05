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
  const spawnFn = options?.spawn ?? defaultSpawn;
  const agent = options?.agent ?? "claude";
  const proc = spawnFn([agent, "-p", prompt]);

  const reader = proc.stdout.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const exitCode = await proc.exitCode;
  const output = new TextDecoder().decode(
    concatUint8Arrays(chunks),
  );

  if (exitCode !== 0) {
    throw new Error(
      `claude process exited with code ${exitCode}: ${output.trim()}`,
    );
  }

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
  // Try raw string first
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // look for first { and last }
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in LLM response: ${raw.slice(0, 200)}`);
  }

  return raw.slice(start, end + 1);
}

export function parseLlmResponse(raw: string): LlmReviewResponse {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON from LLM: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== "object" || parsed === null || !("demos" in parsed)) {
    throw new Error("Missing 'demos' array in review metadata");
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj["demos"])) {
    throw new Error("'demos' must be an array");
  }

  for (const demo of obj["demos"] as unknown[]) {
    if (typeof demo !== "object" || demo === null) {
      throw new Error("Each demo must be an object");
    }
    const d = demo as Record<string, unknown>;

    if (typeof d["file"] !== "string") {
      throw new Error("Each demo must have a 'file' string");
    }
    if (typeof d["summary"] !== "string") {
      throw new Error("Each demo must have a 'summary' string");
    }
  }

  if (typeof obj["review"] !== "object" || obj["review"] === null) {
    throw new Error("Missing 'review' object in response");
  }

  const review = obj["review"] as Record<string, unknown>;

  if (typeof review["summary"] !== "string") {
    throw new Error("review.summary must be a string");
  }

  if (!Array.isArray(review["highlights"])) {
    throw new Error("review.highlights must be an array");
  }
  if (review["highlights"].length === 0) {
    throw new Error("review.highlights must not be empty");
  }
  for (const h of review["highlights"]) {
    if (typeof h !== "string") {
      throw new Error("Each highlight must be a string");
    }
  }

  if (typeof review["verdict"] !== "string" || !VALID_VERDICTS.has(review["verdict"])) {
    throw new Error("review.verdict must be 'approve' or 'request_changes'");
  }

  if (typeof review["verdictReason"] !== "string") {
    throw new Error("review.verdictReason must be a string");
  }

  if (!Array.isArray(review["issues"])) {
    throw new Error("review.issues must be an array");
  }

  for (const issue of review["issues"] as unknown[]) {
    if (typeof issue !== "object" || issue === null) {
      throw new Error("Each issue must be an object");
    }
    const i = issue as Record<string, unknown>;
    if (typeof i["severity"] !== "string" || !VALID_SEVERITIES.has(i["severity"])) {
      throw new Error("Each issue severity must be 'major', 'minor', or 'nit'");
    }
    if (typeof i["description"] !== "string") {
      throw new Error("Each issue must have a 'description' string");
    }
  }

  return parsed as LlmReviewResponse;
}

function defaultSpawn(
  cmd: string[],
): { exitCode: Promise<number>; stdout: ReadableStream<Uint8Array> } {
  const [command, ...args] = cmd;
  const proc = Bun.spawn([command!, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exited,
    stdout: proc.stdout as unknown as ReadableStream<Uint8Array>,
  };
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
