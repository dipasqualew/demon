import type { ReviewMetadata } from "./review-types.ts";

export type SpawnFn = (
  cmd: string[],
) => { exitCode: Promise<number>; stdout: ReadableStream<Uint8Array> };

export interface InvokeClaudeOptions {
  agent?: string;
  spawn?: SpawnFn;
}

export function buildReviewPrompt(filenames: string[]): string {
  const fileList = filenames.map((f) => `- ${f}`).join("\n");

  return `You are given the following .webm demo video filenames:

${fileList}

Based on the filenames, generate a JSON object matching this exact schema:

{
  "demos": [
    {
      "file": "<filename>",
      "summary": "<a short sentence describing what the demo likely shows>",
      "annotations": [
        { "timestampSeconds": <number>, "text": "<annotation text>" }
      ]
    }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown fences or extra text.
- Include one entry in "demos" for each filename, in the same order.
- Infer the summary and annotations from the filename.
- Each demo should have at least one annotation starting at timestampSeconds 0.
- "file" must exactly match the provided filename.`;
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

export function parseReviewMetadata(raw: string): ReviewMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
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
    if (!Array.isArray(d["annotations"])) {
      throw new Error("Each demo must have an 'annotations' array");
    }

    for (const ann of d["annotations"] as unknown[]) {
      if (typeof ann !== "object" || ann === null) {
        throw new Error("Each annotation must be an object");
      }
      const a = ann as Record<string, unknown>;
      if (typeof a["timestampSeconds"] !== "number") {
        throw new Error("Each annotation must have a 'timestampSeconds' number");
      }
      if (typeof a["text"] !== "string") {
        throw new Error("Each annotation must have a 'text' string");
      }
    }
  }

  return parsed as ReviewMetadata;
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
