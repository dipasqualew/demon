#!/usr/bin/env bun
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReviewPrompt,
  invokeClaude,
  parseLlmResponse,
} from "../review.ts";
import { getRepoContext } from "../git-context.ts";
import type { ReviewMetadata, DemoType } from "../review-types.ts";

interface ReviewAppData {
  metadata: ReviewMetadata;
  title: string;
  videos: Record<string, string>;
  logs?: Record<string, string>;
}

interface DemoFile {
  path: string;
  filename: string;
  type: DemoType;
}

function videoToDataUri(filePath: string): string {
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:video/webm;base64,${base64}`;
}

function getReviewTemplate(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const binDir = dirname(currentFile);
  const distDir = dirname(binDir);
  const templatePath = join(distDir, "review-template.html");

  if (!existsSync(templatePath)) {
    throw new Error(
      `Review template not found at ${templatePath}. ` +
        `Make sure to build the review-app package first.`
    );
  }

  return readFileSync(templatePath, "utf-8");
}

function generateReviewHtml(appData: ReviewAppData): string {
  const template = getReviewTemplate();
  const jsonData = JSON.stringify(appData);

  return template
    .replace("<title>Demo Review</title>", `<title>${escapeHtml(appData.title)}</title>`)
    .replace('"{{__INJECT_REVIEW_DATA__}}"', jsonData);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let dir: string | undefined;
let agent: string | undefined;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--agent") {
    agent = args[++i];
  } else if (!dir) {
    dir = args[i];
  }
}

if (!dir) {
  console.error("Usage: demon-demo-review [--agent <path>] <directory>");
  console.error("  Discovers .webm and .jsonl demo files in the given directory.");
  process.exit(1);
}

const resolved = resolve(dir);

if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
  console.error(`Error: "${resolved}" is not a valid directory.`);
  process.exit(1);
}

// Discover demo files (.webm and .jsonl) — search top-level first, then one level deep
// (Playwright creates per-test subdirectories under outputDir)
function discoverDemoFiles(directory: string): DemoFile[] {
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

const demoFiles = discoverDemoFiles(resolved);
const webmFiles = demoFiles.filter((d) => d.type === "web-ux").map((d) => d.path);
const jsonlFiles = demoFiles.filter((d) => d.type === "log-based").map((d) => d.path);

if (demoFiles.length === 0) {
  console.error(`Error: No .webm or .jsonl files found in "${resolved}" or its subdirectories.`);
  process.exit(1);
}

for (const file of demoFiles) {
  console.log(file.path);
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

// For web-ux demos, require steps; for log-based demos, steps are optional
const hasWebUxDemos = webmFiles.length > 0;
const hasLogDemos = jsonlFiles.length > 0;

if (hasWebUxDemos && Object.keys(stepsMap).length === 0) {
  console.error("Error: No demo-steps.json found alongside any .webm files.");
  console.error("Use DemoRecorder in your demo tests to generate step data.");
  process.exit(1);
}

if (!hasWebUxDemos && !hasLogDemos) {
  console.error("Error: No demo files found.");
  process.exit(1);
}

// Gather repo context (git diff + guidelines)
let gitDiff: string | undefined;
let guidelines: string[] | undefined;
try {
  const repoContext = await getRepoContext(resolved);
  gitDiff = repoContext.gitDiff;
  guidelines = repoContext.guidelines;
} catch (err) {
  console.warn(
    "Warning: Could not gather repo context:",
    err instanceof Error ? err.message : err,
  );
}

try {
  const allFilenames = demoFiles.map((d) => d.filename);

  const prompt = buildReviewPrompt({ filenames: allFilenames, stepsMap, gitDiff, guidelines });

  console.log("Invoking claude to generate review metadata...");
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

  const outputPath = join(resolved, "review-metadata.json");
  writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Review metadata written to ${outputPath}`);

  // Build videos map with base64-encoded data URIs
  const videos: Record<string, string> = {};
  for (const webmFile of webmFiles) {
    const filename = basename(webmFile);
    console.log(`Encoding ${filename}...`);
    videos[filename] = videoToDataUri(webmFile);
  }

  // Build app data and generate HTML
  const appData: ReviewAppData = {
    metadata,
    title: "Demo Review",
    videos,
    logs: Object.keys(logsMap).length > 0 ? logsMap : undefined,
  };

  const html = generateReviewHtml(appData);
  const htmlPath = join(resolved, "review.html");
  writeFileSync(htmlPath, html);
  console.log(resolve(htmlPath));
} catch (err) {
  console.error(
    "Error generating review metadata:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
