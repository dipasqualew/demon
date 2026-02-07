import { describe, test, expect } from "bun:test";

import type { GitHubIssue } from "./github-issue.ts";
import type { DemoFile } from "./review-generator.ts";
import { buildPresenterPrompt, buildReviewerPrompt } from "./orchestrator.ts";

const mockIssue: GitHubIssue = {
  number: 42,
  title: "Add user authentication",
  body: `## Description
Add basic user authentication to the app.

## Acceptance Criteria
- [ ] Users can log in with email/password
- [ ] Users can log out
- [ ] Invalid credentials show error message`,
  labels: ["feature", "auth"],
  state: "open",
};

describe("buildPresenterPrompt", () => {
  test("includes issue number and title", () => {
    const prompt = buildPresenterPrompt({
      issue: mockIssue,
      gitDiff: "diff content",
      guidelines: [],
      reviewFolder: "/path/to/review",
      assetsFolder: "/path/to/assets",
      testsFolder: "/path/to/tests",
    });

    expect(prompt).toContain("GitHub Issue #42: Add user authentication");
    expect(prompt).toContain("Add basic user authentication");
    expect(prompt).toContain("Users can log in with email/password");
  });

  test("includes git diff", () => {
    const prompt = buildPresenterPrompt({
      issue: mockIssue,
      gitDiff: "+function login() { return true; }",
      guidelines: [],
      reviewFolder: "/path/to/review",
      assetsFolder: "/path/to/assets",
      testsFolder: "/path/to/tests",
    });

    expect(prompt).toContain("## Git Diff");
    expect(prompt).toContain("+function login() { return true; }");
  });

  test("includes guidelines when provided", () => {
    const prompt = buildPresenterPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: ["# CLAUDE.md\nUse TypeScript", "# SKILL.md\nFollow patterns"],
      reviewFolder: "/path/to/review",
      assetsFolder: "/path/to/assets",
      testsFolder: "/path/to/tests",
    });

    expect(prompt).toContain("## Coding Guidelines");
    expect(prompt).toContain("Use TypeScript");
    expect(prompt).toContain("Follow patterns");
  });

  test("includes folder configuration", () => {
    const prompt = buildPresenterPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: [],
      reviewFolder: "/project/.demoon/reviews/feature-auth",
      assetsFolder: "/project/.demoon/reviews/feature-auth/assets",
      testsFolder: "/project/.demoon/reviews/feature-auth/tests",
    });

    expect(prompt).toContain("**Review Folder:** /project/.demoon/reviews/feature-auth");
    expect(prompt).toContain("**Assets Directory:** /project/.demoon/reviews/feature-auth/assets");
    expect(prompt).toContain("**Tests Directory:** /project/.demoon/reviews/feature-auth/tests");
  });

  test("truncates diff if too long", () => {
    const longDiff = "x".repeat(60_000);
    const prompt = buildPresenterPrompt({
      issue: mockIssue,
      gitDiff: longDiff,
      guidelines: [],
      reviewFolder: "/path",
      assetsFolder: "/path/assets",
      testsFolder: "/path/tests",
    });

    expect(prompt).toContain("... (diff truncated at 50k characters)");
    expect(prompt.length).toBeLessThan(70_000);
  });
});

describe("buildReviewerPrompt", () => {
  const mockDemoFiles: DemoFile[] = [
    { path: "/path/to/login.webm", filename: "login.webm", relativePath: "login.webm", type: "web-ux" },
    { path: "/path/to/api.jsonl", filename: "api.jsonl", relativePath: "api.jsonl", type: "log-based" },
  ];

  test("includes issue information", () => {
    const prompt = buildReviewerPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: [],
      demoFiles: mockDemoFiles,
      stepsMap: {},
      logsMap: {},
    });

    expect(prompt).toContain("GitHub Issue #42: Add user authentication");
    expect(prompt).toContain("Users can log in with email/password");
  });

  test("includes demo recordings section", () => {
    const prompt = buildReviewerPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: [],
      demoFiles: mockDemoFiles,
      stepsMap: {
        "login.webm": [
          { text: "Navigate to login page", timestampSeconds: 0 },
          { text: "Enter credentials", timestampSeconds: 5 },
        ],
      },
      logsMap: {
        "api.jsonl": '{"level":"info","message":"Login successful"}\n{"level":"info","message":"Session created"}',
      },
    });

    expect(prompt).toContain("## Demo Recordings");
    expect(prompt).toContain("Video: login.webm");
    expect(prompt).toContain("[0s] Navigate to login page");
    expect(prompt).toContain("[5s] Enter credentials");
    expect(prompt).toContain("Log: api.jsonl");
    expect(prompt).toContain("Login successful");
  });

  test("shows (no steps recorded) for demos without steps", () => {
    const prompt = buildReviewerPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: [],
      demoFiles: [{ path: "/path/to/demo.webm", filename: "demo.webm", relativePath: "demo.webm", type: "web-ux" }],
      stepsMap: {},
      logsMap: {},
    });

    expect(prompt).toContain("(no steps recorded)");
  });

  test("includes validation rules for acceptance criteria", () => {
    const prompt = buildReviewerPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: [],
      demoFiles: mockDemoFiles,
      stepsMap: {},
      logsMap: {},
    });

    expect(prompt).toContain("Verify that demo steps demonstrate ALL acceptance criteria from the issue");
    expect(prompt).toContain("Use \"request_changes\" if acceptance criteria from the issue are not demonstrated");
  });

  test("requests JSON output format", () => {
    const prompt = buildReviewerPrompt({
      issue: mockIssue,
      gitDiff: "diff",
      guidelines: [],
      demoFiles: mockDemoFiles,
      stepsMap: {},
      logsMap: {},
    });

    expect(prompt).toContain('"verdict": "approve" | "request_changes"');
    expect(prompt).toContain('"severity": "major" | "minor" | "nit"');
    expect(prompt).toContain("Return ONLY the JSON object");
  });
});
