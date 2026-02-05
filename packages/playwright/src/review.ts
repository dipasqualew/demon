export type SpawnFn = (
  cmd: string[],
) => { exitCode: Promise<number>; stdout: ReadableStream<Uint8Array> };

export interface InvokeClaudeOptions {
  agent?: string;
  spawn?: SpawnFn;
}

export function buildReviewPrompt(
  filenames: string[],
  stepsMap: Record<string, Array<{ text: string; timestampSeconds: number }>>,
): string {
  const demoEntries = filenames.map((f) => {
    const steps = stepsMap[f] ?? [];
    const stepLines = steps
      .map((s) => `- [${s.timestampSeconds}s] ${s.text}`)
      .join("\n");
    return `Video: ${f}\nRecorded steps:\n${stepLines || "(no steps recorded)"}`;
  });

  return `You are given the following .webm demo videos with their recorded steps:

${demoEntries.join("\n\n")}

Based on the recorded steps, generate a JSON object matching this exact schema:

{
  "demos": [
    {
      "file": "<filename>",
      "summary": "<a meaningful sentence describing what this demo showcases based on the steps>"
    }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown fences or extra text.
- Include one entry in "demos" for each filename, in the same order.
- Generate a meaningful summary based on what the recorded steps describe.
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

export interface LlmReviewResponse {
  demos: Array<{ file: string; summary: string }>;
}

export function parseLlmResponse(raw: string): LlmReviewResponse {
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
