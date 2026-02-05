import { describe, test, expect } from "bun:test";

import type { SpawnFn } from "./review.ts";
import {
  buildReviewPrompt,
  extractJson,
  invokeClaude,
  parseLlmResponse,
} from "./review.ts";

function makeValidResponse(overrides?: Record<string, unknown>) {
  return {
    demos: [{ file: "login.webm", summary: "Shows a login flow" }],
    review: {
      summary: "Good changes overall",
      highlights: ["Clean implementation"],
      verdict: "approve",
      verdictReason: "No major issues found",
      issues: [],
    },
    ...overrides,
  };
}

describe("buildReviewPrompt", () => {
  test("includes all filenames in the prompt", () => {
    const stepsMap = {
      "login-flow.webm": [],
      "signup.webm": [],
    };
    const prompt = buildReviewPrompt({ filenames: ["login-flow.webm", "signup.webm"], stepsMap });
    expect(prompt).toContain("login-flow.webm");
    expect(prompt).toContain("signup.webm");
  });

  test("includes schema instructions", () => {
    const stepsMap = { "demo.webm": [] };
    const prompt = buildReviewPrompt({ filenames: ["demo.webm"], stepsMap });
    expect(prompt).toContain('"demos"');
    expect(prompt).toContain('"file"');
    expect(prompt).toContain('"summary"');
  });

  test("does not include annotations in schema", () => {
    const stepsMap = { "demo.webm": [] };
    const prompt = buildReviewPrompt({ filenames: ["demo.webm"], stepsMap });
    expect(prompt).not.toContain('"annotations"');
  });

  test("includes step data in prompt", () => {
    const stepsMap = {
      "login-flow.webm": [
        { text: "Navigate to login", timestampSeconds: 0.5 },
        { text: "Enter credentials", timestampSeconds: 3.2 },
      ],
    };
    const prompt = buildReviewPrompt({ filenames: ["login-flow.webm"], stepsMap });
    expect(prompt).toContain("[0.5s] Navigate to login");
    expect(prompt).toContain("[3.2s] Enter credentials");
    expect(prompt).toContain("Recorded steps:");
  });

  test("shows (no steps recorded) when steps array is empty", () => {
    const stepsMap = { "demo.webm": [] };
    const prompt = buildReviewPrompt({ filenames: ["demo.webm"], stepsMap });
    expect(prompt).toContain("(no steps recorded)");
  });

  test("shows (no steps recorded) when video not in stepsMap", () => {
    const stepsMap = { "other.webm": [] };
    const prompt = buildReviewPrompt({ filenames: ["demo.webm"], stepsMap });
    expect(prompt).toContain("(no steps recorded)");
  });

  test("includes git diff when provided", () => {
    const prompt = buildReviewPrompt({
      filenames: ["demo.webm"],
      stepsMap: { "demo.webm": [] },
      gitDiff: "diff --git a/file.ts\n+added line",
    });
    expect(prompt).toContain("## Git Diff");
    expect(prompt).toContain("+added line");
  });

  test("does not include git diff section when not provided", () => {
    const prompt = buildReviewPrompt({
      filenames: ["demo.webm"],
      stepsMap: { "demo.webm": [] },
    });
    expect(prompt).not.toContain("## Git Diff");
  });

  test("includes guidelines when provided", () => {
    const prompt = buildReviewPrompt({
      filenames: ["demo.webm"],
      stepsMap: { "demo.webm": [] },
      guidelines: ["# CLAUDE.md\nUse dependency injection"],
    });
    expect(prompt).toContain("## Coding Guidelines");
    expect(prompt).toContain("Use dependency injection");
  });

  test("does not include guidelines section when empty", () => {
    const prompt = buildReviewPrompt({
      filenames: ["demo.webm"],
      stepsMap: { "demo.webm": [] },
      guidelines: [],
    });
    expect(prompt).not.toContain("## Coding Guidelines");
  });

  test("truncates git diff at 50k characters", () => {
    const longDiff = "x".repeat(60_000);
    const prompt = buildReviewPrompt({
      filenames: ["demo.webm"],
      stepsMap: { "demo.webm": [] },
      gitDiff: longDiff,
    });
    expect(prompt).toContain("diff truncated at 50k characters");
    expect(prompt).not.toContain("x".repeat(60_000));
  });

  test("includes review schema in prompt", () => {
    const prompt = buildReviewPrompt({
      filenames: ["demo.webm"],
      stepsMap: { "demo.webm": [] },
    });
    expect(prompt).toContain('"review"');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"issues"');
    expect(prompt).toContain('"highlights"');
  });
});

describe("extractJson", () => {
  test("returns raw string when it is valid JSON", () => {
    const json = '{"key": "value"}';
    expect(extractJson(json)).toBe(json);
  });

  test("strips preamble text before JSON object", () => {
    const raw = 'Here is the review.\n\n{"demos": []}';
    expect(extractJson(raw)).toBe('{"demos": []}');
  });

  test("strips trailing text after JSON object", () => {
    const raw = '{"demos": []}\n\nHope this helps!';
    expect(extractJson(raw)).toBe('{"demos": []}');
  });

  test("strips both preamble and trailing text", () => {
    const raw = 'Let me analyze this.\n{"demos": []}\nDone.';
    expect(extractJson(raw)).toBe('{"demos": []}');
  });

  test("handles nested braces correctly", () => {
    const json = '{"a": {"b": "c"}}';
    const raw = `Some preamble\n${json}\nsome trailing`;
    expect(extractJson(raw)).toBe(json);
  });

  test("throws when no JSON object found", () => {
    expect(() => extractJson("no json here at all")).toThrow("No JSON object found");
  });

  test("throws when only opening brace", () => {
    expect(() => extractJson("just { nothing")).toThrow("No JSON object found");
  });
});

describe("parseLlmResponse", () => {
  test("parses valid input correctly", () => {
    const result = parseLlmResponse(JSON.stringify(makeValidResponse()));
    expect(result.demos).toHaveLength(1);
    expect(result.demos[0]!.file).toBe("login.webm");
    expect(result.demos[0]!.summary).toBe("Shows a login flow");
    expect(result.review.verdict).toBe("approve");
    expect(result.review.summary).toBe("Good changes overall");
    expect(result.review.highlights).toEqual(["Clean implementation"]);
    expect(result.review.issues).toEqual([]);
  });

  test("parses response with issues", () => {
    const input = makeValidResponse({
      review: {
        summary: "Needs work",
        highlights: ["Good tests"],
        verdict: "request_changes",
        verdictReason: "Major bug found",
        issues: [
          { severity: "major", description: "Null pointer dereference" },
          { severity: "minor", description: "Missing error message" },
          { severity: "nit", description: "Inconsistent naming" },
        ],
      },
    });
    const result = parseLlmResponse(JSON.stringify(input));
    expect(result.review.issues).toHaveLength(3);
    expect(result.review.issues[0]!.severity).toBe("major");
    expect(result.review.verdict).toBe("request_changes");
  });

  test("parses response with preamble text before JSON", () => {
    const json = JSON.stringify(makeValidResponse());
    const raw = `Let me review the changes.\n\n${json}`;
    const result = parseLlmResponse(raw);
    expect(result.demos).toHaveLength(1);
    expect(result.review.verdict).toBe("approve");
  });

  test("parses response with trailing text after JSON", () => {
    const json = JSON.stringify(makeValidResponse());
    const raw = `${json}\n\nHope this helps!`;
    const result = parseLlmResponse(raw);
    expect(result.demos).toHaveLength(1);
  });

  test("throws when no JSON object found", () => {
    expect(() => parseLlmResponse("not json at all")).toThrow("No JSON object found");
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
        JSON.stringify({ demos: [{ summary: "x" }], review: makeValidResponse().review }),
      ),
    ).toThrow("'file' string");
  });

  test("throws when demo is missing summary", () => {
    expect(() =>
      parseLlmResponse(
        JSON.stringify({ demos: [{ file: "x" }], review: makeValidResponse().review }),
      ),
    ).toThrow("'summary' string");
  });

  test("throws when review object is missing", () => {
    expect(() =>
      parseLlmResponse(
        JSON.stringify({ demos: [{ file: "x", summary: "s" }] }),
      ),
    ).toThrow("Missing 'review' object");
  });

  test("throws when review.verdict is invalid", () => {
    const input = makeValidResponse({
      review: { ...makeValidResponse().review, verdict: "maybe" },
    });
    expect(() => parseLlmResponse(JSON.stringify(input))).toThrow(
      "review.verdict must be 'approve' or 'request_changes'",
    );
  });

  test("throws when review.highlights is empty", () => {
    const input = makeValidResponse({
      review: { ...makeValidResponse().review, highlights: [] },
    });
    expect(() => parseLlmResponse(JSON.stringify(input))).toThrow(
      "review.highlights must not be empty",
    );
  });

  test("throws when review.summary is missing", () => {
    const input = makeValidResponse({
      review: { ...makeValidResponse().review, summary: 42 },
    });
    expect(() => parseLlmResponse(JSON.stringify(input))).toThrow(
      "review.summary must be a string",
    );
  });

  test("throws when review.verdictReason is missing", () => {
    const input = makeValidResponse({
      review: { ...makeValidResponse().review, verdictReason: null },
    });
    expect(() => parseLlmResponse(JSON.stringify(input))).toThrow(
      "review.verdictReason must be a string",
    );
  });

  test("throws when issue has invalid severity", () => {
    const input = makeValidResponse({
      review: {
        ...makeValidResponse().review,
        issues: [{ severity: "critical", description: "bad" }],
      },
    });
    expect(() => parseLlmResponse(JSON.stringify(input))).toThrow(
      "Each issue severity must be 'major', 'minor', or 'nit'",
    );
  });

  test("throws when issue is missing description", () => {
    const input = makeValidResponse({
      review: {
        ...makeValidResponse().review,
        issues: [{ severity: "major" }],
      },
    });
    expect(() => parseLlmResponse(JSON.stringify(input))).toThrow(
      "Each issue must have a 'description' string",
    );
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
