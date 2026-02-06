import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReviewPrompt,
  invokeClaude,
  parseLlmResponse,
} from "./review.ts";
import { getRepoContext } from "./git-context.ts";
import type { ReviewMetadata, DemoType } from "./review-types.ts";

export interface ReviewAppData {
  metadata: ReviewMetadata;
  title: string;
  videos: Record<string, string>;
  logs?: Record<string, string>;
  feedbackEndpoint?: string;
}

export interface DemoFile {
  path: string;
  filename: string;
  type: DemoType;
}

export interface GenerateReviewOptions {
  directory: string;
  agent?: string;
  feedbackEndpoint?: string;
  title?: string;
}

export interface GenerateReviewResult {
  htmlPath: string;
  metadataPath: string;
  metadata: ReviewMetadata;
}

export function videoToDataUri(filePath: string): string {
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:video/webm;base64,${base64}`;
}

export function getReviewTemplate(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const distDir = dirname(currentFile);
  const templatePath = join(distDir, "review-template.html");

  if (!existsSync(templatePath)) {
    throw new Error(
      `Review template not found at ${templatePath}. ` +
        `Make sure to build the review-app package first.`
    );
  }

  return readFileSync(templatePath, "utf-8");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateReviewHtml(appData: ReviewAppData): string {
  const template = getReviewTemplate();
  const jsonData = JSON.stringify(appData);

  return template
    .replace("<title>Demo Review</title>", `<title>${escapeHtml(appData.title)}</title>`)
    .replace('"{{__INJECT_REVIEW_DATA__}}"', jsonData);
}

/**
 * Discover demo files (.webm and .jsonl) in the given directory.
 * Searches top-level first, then one level deep (Playwright creates per-test subdirectories).
 */
export function discoverDemoFiles(directory: string): DemoFile[] {
  const files: DemoFile[] = [];

  const processFile = (filePath: string, filename: string) => {
    if (filename.endsWith(".webm")) {
      files.push({ path: filePath, filename, type: "web-ux" });
    } else if (filename.endsWith(".jsonl")) {
      files.push({ path: filePath, filename, type: "log-based" });
    }
  };

  // Search top-level
  for (const f of readdirSync(directory)) {
    processFile(join(directory, f), f);
  }

  // If no files found at top level, search one level deep
  if (files.length === 0) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const subdir = join(directory, entry.name);
      for (const f of readdirSync(subdir)) {
        processFile(join(subdir, f), f);
      }
    }
  }

  return files.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Generate a review HTML page from demo files in the given directory.
 * This is the main entry point for programmatic use.
 */
export async function generateReview(options: GenerateReviewOptions): Promise<GenerateReviewResult> {
  const { directory, agent, feedbackEndpoint, title = "Demo Review" } = options;

  const demoFiles = discoverDemoFiles(directory);
  const webmFiles = demoFiles.filter((d) => d.type === "web-ux").map((d) => d.path);
  const jsonlFiles = demoFiles.filter((d) => d.type === "log-based").map((d) => d.path);

  if (demoFiles.length === 0) {
    throw new Error(`No .webm or .jsonl files found in "${directory}" or its subdirectories.`);
  }

  // Collect demo-steps.json from the directory of each .webm file
  const stepsMap: Record<string, Array<{ text: string; timestampSeconds: number }>> = {};
  for (const webmFile of webmFiles) {
    const stepsPath = join(dirname(webmFile), "demo-steps.json");
    if (!existsSync(stepsPath)) continue;
    try {
      const raw = readFileSync(stepsPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        stepsMap[basename(webmFile)] = parsed;
      }
    } catch {
      // skip malformed steps files
    }
  }

  // Collect JSONL content for log-based demos
  const logsMap: Record<string, string> = {};
  for (const jsonlFile of jsonlFiles) {
    const filename = basename(jsonlFile);
    logsMap[filename] = readFileSync(jsonlFile, "utf-8");
  }

  // For web-ux demos, require steps
  const hasWebUxDemos = webmFiles.length > 0;
  const hasLogDemos = jsonlFiles.length > 0;

  if (hasWebUxDemos && Object.keys(stepsMap).length === 0) {
    throw new Error(
      "No demo-steps.json found alongside any .webm files. " +
        "Use DemoRecorder in your demo tests to generate step data."
    );
  }

  if (!hasWebUxDemos && !hasLogDemos) {
    throw new Error("No demo files found.");
  }

  // Gather repo context (git diff + guidelines)
  let gitDiff: string | undefined;
  let guidelines: string[] | undefined;
  try {
    const repoContext = await getRepoContext(directory);
    gitDiff = repoContext.gitDiff;
    guidelines = repoContext.guidelines;
  } catch {
    // Silently continue without repo context
  }

  const allFilenames = demoFiles.map((d) => d.filename);
  const prompt = buildReviewPrompt({ filenames: allFilenames, stepsMap, gitDiff, guidelines });

  const rawOutput = await invokeClaude(prompt, { agent });
  const llmResponse = parseLlmResponse(rawOutput);

  // Build a map of filename to type for easy lookup
  const typeMap = new Map(demoFiles.map((d) => [d.filename, d.type]));

  // Construct final metadata by merging LLM summaries with steps and type
  const metadata: ReviewMetadata = {
    demos: llmResponse.demos.map((demo) => ({
      file: demo.file,
      type: typeMap.get(demo.file) ?? "web-ux",
      summary: demo.summary,
      steps: stepsMap[demo.file] ?? [],
    })),
    review: llmResponse.review,
  };

  const metadataPath = join(directory, "review-metadata.json");
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");

  // Build videos map with base64-encoded data URIs
  const videos: Record<string, string> = {};
  for (const webmFile of webmFiles) {
    const filename = basename(webmFile);
    videos[filename] = videoToDataUri(webmFile);
  }

  // Build app data and generate HTML
  const appData: ReviewAppData = {
    metadata,
    title,
    videos,
    logs: Object.keys(logsMap).length > 0 ? logsMap : undefined,
    feedbackEndpoint,
  };

  const html = generateReviewHtml(appData);
  const htmlPath = join(directory, "review.html");
  writeFileSync(htmlPath, html);

  return { htmlPath, metadataPath, metadata };
}
