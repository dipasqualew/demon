import { describe, test, expect } from "bun:test";

import type { SpawnFn } from "./review.ts";
import {
  buildReviewPrompt,
  invokeClaude,
  parseLlmResponse,
} from "./review.ts";

describe("buildReviewPrompt", () => {
  test("includes all filenames in the prompt", () => {
    const stepsMap = {
      "login-flow.webm": [],
      "signup.webm": [],
    };
    const prompt = buildReviewPrompt(["login-flow.webm", "signup.webm"], stepsMap);
    expect(prompt).toContain("login-flow.webm");
    expect(prompt).toContain("signup.webm");
  });

  test("includes schema instructions", () => {
    const stepsMap = { "demo.webm": [] };
    const prompt = buildReviewPrompt(["demo.webm"], stepsMap);
    expect(prompt).toContain('"demos"');
    expect(prompt).toContain('"file"');
    expect(prompt).toContain('"summary"');
  });

  test("does not include annotations in schema", () => {
    const stepsMap = { "demo.webm": [] };
    const prompt = buildReviewPrompt(["demo.webm"], stepsMap);
    expect(prompt).not.toContain('"annotations"');
  });

  test("includes step data in prompt", () => {
    const stepsMap = {
      "login-flow.webm": [
        { text: "Navigate to login", timestampSeconds: 0.5 },
        { text: "Enter credentials", timestampSeconds: 3.2 },
      ],
    };
    const prompt = buildReviewPrompt(["login-flow.webm"], stepsMap);
    expect(prompt).toContain("[0.5s] Navigate to login");
    expect(prompt).toContain("[3.2s] Enter credentials");
    expect(prompt).toContain("Recorded steps:");
  });

  test("shows (no steps recorded) when steps array is empty", () => {
    const stepsMap = { "demo.webm": [] };
    const prompt = buildReviewPrompt(["demo.webm"], stepsMap);
    expect(prompt).toContain("(no steps recorded)");
  });

  test("shows (no steps recorded) when video not in stepsMap", () => {
    const stepsMap = { "other.webm": [] };
    const prompt = buildReviewPrompt(["demo.webm"], stepsMap);
    expect(prompt).toContain("(no steps recorded)");
  });
});

describe("parseLlmResponse", () => {
  const validInput = JSON.stringify({
    demos: [
      {
        file: "login.webm",
        summary: "Shows a login flow",
      },
    ],
  });

  test("parses valid input correctly", () => {
    const result = parseLlmResponse(validInput);
    expect(result.demos).toHaveLength(1);
    expect(result.demos[0]!.file).toBe("login.webm");
    expect(result.demos[0]!.summary).toBe("Shows a login flow");
  });

  test("throws on invalid JSON", () => {
    expect(() => parseLlmResponse("not json")).toThrow("Invalid JSON");
  });

  test("throws when demos array is missing", () => {
    expect(() => parseLlmResponse("{}")).toThrow("Missing 'demos' array");
  });

  test("throws when demos is not an array", () => {
    expect(() => parseLlmResponse('{"demos": "nope"}')).toThrow(
      "'demos' must be an array",
    );
  });

  test("throws when demo is missing file", () => {
    expect(() =>
      parseLlmResponse(
        JSON.stringify({ demos: [{ summary: "x" }] }),
      ),
    ).toThrow("'file' string");
  });

  test("throws when demo is missing summary", () => {
    expect(() =>
      parseLlmResponse(
        JSON.stringify({ demos: [{ file: "x" }] }),
      ),
    ).toThrow("'summary' string");
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
