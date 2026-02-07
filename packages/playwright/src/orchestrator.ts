import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname as pathDirname } from "node:path";
import { spawnSync } from "node:child_process";

import type { SpawnFn } from "./review.ts";
import { invokeClaude, parseLlmResponse } from "./review.ts";
import { getRepoContext, type ExecFn } from "./git-context.ts";
import { fetchGitHubIssue, type GitHubIssue, type FetchGitHubIssueOptions } from "./github-issue.ts";
import {
  discoverDemoFiles,
  generateReviewHtml,
  type ReviewAppData,
  type DemoFile,
} from "./review-generator.ts";
import type { ReviewMetadata, DemoType } from "./review-types.ts";

export interface OrchestratorOptions {
  issueId: string | number;
  issue?: GitHubIssue;  // Pre-loaded issue (skips GitHub API fetch)
  diffBase?: string;
  agent?: string;
  feedbackEndpoint?: string;  // URL for feedback submission (enables MCP integration)
  spawn?: SpawnFn;
  exec?: ExecFn;
  cwd?: string;
  github?: FetchGitHubIssueOptions;
}

export interface OrchestratorResult {
  reviewFolder: string;
  htmlPath: string;
  metadataPath: string;
  metadata: ReviewMetadata;
  issue: GitHubIssue;
}

const GIT_DIFF_MAX_CHARS = 50_000;

const defaultExec: ExecFn = async (cmd: string[], cwd: string) => {
  const [command, ...args] = cmd;
  const proc = spawnSync(command!, args, { cwd, encoding: "utf-8" });
  if (proc.status !== 0) {
    const stderr = (proc.stderr ?? "").trim();
    throw new Error(`Command failed (exit ${proc.status}): ${cmd.join(" ")}${stderr ? `: ${stderr}` : ""}`);
  }
  return proc.stdout ?? "";
};

async function getGitRoot(exec: ExecFn, cwd: string): Promise<string> {
  return (await exec(["git", "rev-parse", "--show-toplevel"], cwd)).trim();
}

async function getCurrentBranch(exec: ExecFn, cwd: string): Promise<string> {
  const branch = (await exec(["git", "branch", "--show-current"], cwd)).trim();
  return branch.replace(/\//g, "-") || "unknown";
}

export function buildPresenterPrompt(options: {
  issue: GitHubIssue;
  gitDiff: string;
  guidelines: string[];
  reviewFolder: string;
  assetsFolder: string;
  testsFolder: string;
}): string {
  const { issue, gitDiff, guidelines, reviewFolder, assetsFolder, testsFolder } = options;

  let diff = gitDiff;
  if (diff.length > GIT_DIFF_MAX_CHARS) {
    diff = diff.slice(0, GIT_DIFF_MAX_CHARS) + "\n\n... (diff truncated at 50k characters)";
  }

  const sections: string[] = [];

  sections.push(`## GitHub Issue #${issue.number}: ${issue.title}\n\n${issue.body}`);

  if (guidelines.length > 0) {
    sections.push(`## Coding Guidelines\n\n${guidelines.join("\n\n")}`);
  }

  sections.push(`## Git Diff\n\n\`\`\`diff\n${diff}\n\`\`\``);

  return `You are a demo presenter. You must create demo recordings that showcase the feature described in the GitHub issue.

${sections.join("\n\n")}

## Configuration

- **Review Folder:** ${reviewFolder}
- **Assets Directory:** ${assetsFolder}
- **Tests Directory:** ${testsFolder}

## Task

Based on the GitHub issue and git diff above, create demo recordings that demonstrate each acceptance criterion is met.

For web-ux demos:
- Create Playwright test files in the Tests Directory
- Use DemoRecorder to capture steps
- Save recordings to the Assets Directory

For log-based demos:
- Create .jsonl files directly in the Assets Directory
- Use demon__highlight annotations for key lines

After creating demos, report:
1. List of demo test files created (paths to .demo.ts files)
2. List of artifact files generated (.webm for web-ux, .jsonl for log-based)
3. Any errors encountered`;
}

export function buildReviewerPrompt(options: {
  issue: GitHubIssue;
  gitDiff: string;
  guidelines: string[];
  demoFiles: DemoFile[];
  stepsMap: Record<string, Array<{ text: string; timestampSeconds: number }>>;
  logsMap: Record<string, string>;
}): string {
  const { issue, gitDiff, guidelines, demoFiles, stepsMap, logsMap } = options;

  let diff = gitDiff;
  if (diff.length > GIT_DIFF_MAX_CHARS) {
    diff = diff.slice(0, GIT_DIFF_MAX_CHARS) + "\n\n... (diff truncated at 50k characters)";
  }

  const sections: string[] = [];

  sections.push(`## GitHub Issue #${issue.number}: ${issue.title}\n\n${issue.body}`);

  if (guidelines.length > 0) {
    sections.push(`## Coding Guidelines\n\n${guidelines.join("\n\n")}`);
  }

  sections.push(`## Git Diff\n\n\`\`\`diff\n${diff}\n\`\`\``);

  const demoEntries = demoFiles.map((f) => {
    if (f.type === "web-ux") {
      const steps = stepsMap[f.filename] ?? stepsMap[f.relativePath] ?? [];
      const stepLines = steps
        .map((s) => `- [${s.timestampSeconds}s] ${s.text}`)
        .join("\n");
      return `Video: ${f.relativePath}\nRecorded steps:\n${stepLines || "(no steps recorded)"}`;
    } else {
      const logContent = logsMap[f.relativePath] ?? "";
      const preview = logContent.split("\n").slice(0, 20).join("\n");
      return `Log: ${f.relativePath}\nContent preview:\n${preview}`;
    }
  });

  sections.push(`## Demo Recordings\n\n${demoEntries.join("\n\n")}`);

  return `You are a code reviewer. You are given a GitHub issue, git diff, coding guidelines, and demo recordings that show the feature in action.

${sections.join("\n\n")}

## Task

Review the code changes and demo recordings against the GitHub issue's acceptance criteria. Generate a JSON object matching this exact schema:

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
- Include one entry in "demos" for each demo file, in the same order.
- "file" must exactly match the provided relative path.
- "verdict" must be exactly "approve" or "request_changes".
- Use "request_changes" if acceptance criteria from the issue are not demonstrated.
- "severity" must be exactly "major", "minor", or "nit".
- "major": bugs, security issues, broken functionality, missing acceptance criteria.
- "minor": code quality, readability, missing edge cases.
- "nit": style, naming, trivial improvements.
- "highlights" must have at least one entry.
- "issues" can be an empty array if there are no issues.
- Verify that demo steps demonstrate ALL acceptance criteria from the issue.`;
}

function collectDemoData(
  demoFiles: DemoFile[],
): {
  stepsMapByFilename: Record<string, Array<{ text: string; timestampSeconds: number }>>;
  stepsMapByRelativePath: Record<string, Array<{ text: string; timestampSeconds: number }>>;
  logsMap: Record<string, string>;
} {
  const stepsMapByFilename: Record<string, Array<{ text: string; timestampSeconds: number }>> = {};
  const stepsMapByRelativePath: Record<string, Array<{ text: string; timestampSeconds: number }>> = {};
  const logsMap: Record<string, string> = {};

  for (const demo of demoFiles) {
    if (demo.type === "web-ux") {
      const stepsPath = join(pathDirname(demo.path), "demo-steps.json");
      if (existsSync(stepsPath)) {
        try {
          const raw = readFileSync(stepsPath, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            stepsMapByFilename[demo.filename] = parsed;
            stepsMapByRelativePath[demo.relativePath] = parsed;
          }
        } catch {
          // skip malformed
        }
      }
    } else {
      logsMap[demo.relativePath] = readFileSync(demo.path, "utf-8");
    }
  }

  return { stepsMapByFilename, stepsMapByRelativePath, logsMap };
}

export async function runReviewOrchestration(
  options: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const exec = options.exec ?? defaultExec;
  const cwd = options.cwd ?? process.cwd();

  // 1. Fetch GitHub issue (or use pre-loaded issue)
  const issue = options.issue ?? await fetchGitHubIssue(options.issueId, options.github);

  // 2. Get repo context (git diff + guidelines)
  const gitRoot = await getGitRoot(exec, cwd);
  const branchName = await getCurrentBranch(exec, cwd);

  const repoContext = await getRepoContext(gitRoot, {
    exec,
    diffBase: options.diffBase,
  });

  // 3. Create review folder structure
  const reviewFolder = join(gitRoot, ".demoon", "reviews", branchName);
  const assetsFolder = join(reviewFolder, "assets");
  const testsFolder = join(reviewFolder, "tests");

  if (!existsSync(reviewFolder)) {
    mkdirSync(reviewFolder, { recursive: true });
  }
  if (!existsSync(assetsFolder)) {
    mkdirSync(assetsFolder, { recursive: true });
  }
  if (!existsSync(testsFolder)) {
    mkdirSync(testsFolder, { recursive: true });
  }

  // 4. Run Presenter phase
  const presenterPrompt = buildPresenterPrompt({
    issue,
    gitDiff: repoContext.gitDiff,
    guidelines: repoContext.guidelines,
    reviewFolder,
    assetsFolder,
    testsFolder,
  });

  await invokeClaude(presenterPrompt, { agent: options.agent, spawn: options.spawn });

  // 5. Discover generated demos
  const demoFiles = discoverDemoFiles(assetsFolder);

  if (demoFiles.length === 0) {
    throw new Error(`No demo files (.webm or .jsonl) found in ${assetsFolder} after Presenter phase`);
  }

  // 6. Collect demo data (steps, logs)
  const { stepsMapByFilename, stepsMapByRelativePath, logsMap } = collectDemoData(
    demoFiles,
  );

  // 7. Run Reviewer phase
  const reviewerPrompt = buildReviewerPrompt({
    issue,
    gitDiff: repoContext.gitDiff,
    guidelines: repoContext.guidelines,
    demoFiles,
    stepsMap: stepsMapByFilename,
    logsMap,
  });

  const rawOutput = await invokeClaude(reviewerPrompt, { agent: options.agent, spawn: options.spawn });
  const llmResponse = parseLlmResponse(rawOutput);

  // 8. Build metadata
  const filenameToRelativePath = new Map(demoFiles.map((d) => [d.filename, d.relativePath]));
  const typeMap = new Map<string, DemoType>(demoFiles.map((d) => [d.filename, d.type]));

  const metadata: ReviewMetadata = {
    demos: llmResponse.demos.map((demo) => {
      const relativePath = filenameToRelativePath.get(demo.file) ?? demo.file;
      return {
        file: relativePath,
        type: typeMap.get(demo.file) ?? "web-ux",
        summary: demo.summary,
        steps: stepsMapByRelativePath[relativePath] ?? [],
      };
    }),
    review: llmResponse.review,
  };

  // 9. Write metadata and HTML
  const metadataPath = join(assetsFolder, "review-metadata.json");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");

  const appData: ReviewAppData = {
    metadata,
    title: `Review: Issue #${issue.number} - ${issue.title}`,
    videos: {},
    logs: Object.keys(logsMap).length > 0 ? logsMap : undefined,
    feedbackEndpoint: options.feedbackEndpoint,
  };

  const html = generateReviewHtml(appData);
  const htmlPath = join(assetsFolder, "review.html");
  writeFileSync(htmlPath, html);

  return {
    reviewFolder,
    htmlPath,
    metadataPath,
    metadata,
    issue,
  };
}
