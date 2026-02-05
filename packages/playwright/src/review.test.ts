import { describe, test, expect } from "bun:test";

import type { SpawnFn } from "./review.ts";
import {
  buildReviewPrompt,
  invokeClaude,
  parseReviewMetadata,
} from "./review.ts";

describe("buildReviewPrompt", () => {
  test("includes all filenames in the prompt", () => {
    const prompt = buildReviewPrompt(["login-flow.webm", "signup.webm"]);
    expect(prompt).toContain("- login-flow.webm");
    expect(prompt).toContain("- signup.webm");
  });

  test("includes schema instructions", () => {
    const prompt = buildReviewPrompt(["demo.webm"]);
    expect(prompt).toContain('"demos"');
    expect(prompt).toContain('"file"');
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"annotations"');
    expect(prompt).toContain('"timestampSeconds"');
  });
});

describe("parseReviewMetadata", () => {
  const validInput = JSON.stringify({
    demos: [
      {
        file: "login.webm",
        summary: "Shows a login flow",
        annotations: [{ timestampSeconds: 0, text: "Start" }],
      },
    ],
  });

  test("parses valid input correctly", () => {
    const result = parseReviewMetadata(validInput);
    expect(result.demos).toHaveLength(1);
    expect(result.demos[0]!.file).toBe("login.webm");
    expect(result.demos[0]!.summary).toBe("Shows a login flow");
    expect(result.demos[0]!.annotations).toHaveLength(1);
    expect(result.demos[0]!.annotations[0]!.timestampSeconds).toBe(0);
    expect(result.demos[0]!.annotations[0]!.text).toBe("Start");
  });

  test("throws on invalid JSON", () => {
    expect(() => parseReviewMetadata("not json")).toThrow("Invalid JSON");
  });

  test("throws when demos array is missing", () => {
    expect(() => parseReviewMetadata("{}")).toThrow("Missing 'demos' array");
  });

  test("throws when demos is not an array", () => {
    expect(() => parseReviewMetadata('{"demos": "nope"}')).toThrow(
      "'demos' must be an array",
    );
  });

  test("throws when demo is missing file", () => {
    expect(() =>
      parseReviewMetadata(
        JSON.stringify({ demos: [{ summary: "x", annotations: [] }] }),
      ),
    ).toThrow("'file' string");
  });

  test("throws when demo is missing summary", () => {
    expect(() =>
      parseReviewMetadata(
        JSON.stringify({ demos: [{ file: "x", annotations: [] }] }),
      ),
    ).toThrow("'summary' string");
  });

  test("throws when annotations is missing", () => {
    expect(() =>
      parseReviewMetadata(
        JSON.stringify({ demos: [{ file: "x", summary: "s" }] }),
      ),
    ).toThrow("'annotations' array");
  });

  test("throws when annotation has wrong timestampSeconds type", () => {
    expect(() =>
      parseReviewMetadata(
        JSON.stringify({
          demos: [
            {
              file: "x",
              summary: "s",
              annotations: [{ timestampSeconds: "0", text: "t" }],
            },
          ],
        }),
      ),
    ).toThrow("'timestampSeconds' number");
  });

  test("throws when annotation has wrong text type", () => {
    expect(() =>
      parseReviewMetadata(
        JSON.stringify({
          demos: [
            {
              file: "x",
              summary: "s",
              annotations: [{ timestampSeconds: 0, text: 123 }],
            },
          ],
        }),
      ),
    ).toThrow("'text' string");
  });
});

describe("invokeClaude", () => {
  function mockSpawn(
    stdout: string,
    exitCode: number,
  ): SpawnFn {
    return (_cmd: string[]) => ({
      exitCode: Promise.resolve(exitCode),
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(stdout));
          controller.close();
        },
      }),
    });
  }

  test("returns stdout on success", async () => {
    const result = await invokeClaude("test prompt", { spawn: mockSpawn("hello", 0) });
    expect(result).toBe("hello");
  });

  test("trims whitespace from output", async () => {
    const result = await invokeClaude(
      "test prompt",
      { spawn: mockSpawn("  hello  \n", 0) },
    );
    expect(result).toBe("hello");
  });

  test("throws on non-zero exit code", async () => {
    try {
      await invokeClaude("test prompt", { spawn: mockSpawn("error msg", 1) });
      expect(true).toBe(false); // should not reach here
    } catch (e) {
      expect((e as Error).message).toContain("exited with code 1");
    }
  });

  test("passes agent option to spawn command", async () => {
    let capturedCmd: string[] = [];
    const spySpawn: SpawnFn = (cmd) => {
      capturedCmd = cmd;
      return mockSpawn("ok", 0)(cmd);
    };
    await invokeClaude("test prompt", { agent: "my-agent", spawn: spySpawn });
    expect(capturedCmd[0]).toBe("my-agent");
    expect(capturedCmd[1]).toBe("-p");
  });
});
