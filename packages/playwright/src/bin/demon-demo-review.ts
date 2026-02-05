#!/usr/bin/env bun
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";

import {
  buildReviewPrompt,
  invokeClaude,
  parseLlmResponse,
} from "../review.ts";
import { generateReviewHtml } from "../html-generator.ts";
import type { ReviewMetadata } from "../review-types.ts";

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
  console.error("  Discovers .webm video files in the given directory.");
  process.exit(1);
}

const resolved = resolve(dir);

if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
  console.error(`Error: "${resolved}" is not a valid directory.`);
  process.exit(1);
}

const webmFiles = readdirSync(resolved)
  .filter((f) => f.endsWith(".webm"))
  .map((f) => join(resolved, f))
  .sort();

if (webmFiles.length === 0) {
  console.error(`Error: No .webm files found in "${resolved}".`);
  process.exit(1);
}

for (const file of webmFiles) {
  console.log(file);
}

// Require demo-steps.json
const stepsPath = join(resolved, "demo-steps.json");
if (!existsSync(stepsPath)) {
  console.error(`Error: No demo-steps.json found in "${resolved}".`);
  console.error("Use DemoRecorder in your demo tests to generate step data.");
  process.exit(1);
}

let steps: Array<{ text: string; timestampSeconds: number }>;
try {
  const raw = readFileSync(stepsPath, "utf-8");
  steps = JSON.parse(raw);
  if (!Array.isArray(steps)) {
    throw new Error("demo-steps.json must be an array");
  }
} catch (err) {
  console.error(
    "Error reading demo-steps.json:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}

try {
  const basenames = webmFiles.map((f) => basename(f));

  // Build stepsMap - all videos share the same steps file for now
  const stepsMap: Record<string, Array<{ text: string; timestampSeconds: number }>> = {};
  for (const name of basenames) {
    stepsMap[name] = steps;
  }

  const prompt = buildReviewPrompt(basenames, stepsMap);

  console.log("Invoking claude to generate review metadata...");
  const rawOutput = await invokeClaude(prompt, { agent });

  const llmResponse = parseLlmResponse(rawOutput);

  // Construct final metadata by merging LLM summaries with steps
  const metadata: ReviewMetadata = {
    demos: llmResponse.demos.map((demo) => ({
      file: demo.file,
      summary: demo.summary,
      steps: stepsMap[demo.file] ?? [],
    })),
  };

  const outputPath = join(resolved, "review-metadata.json");
  writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Review metadata written to ${outputPath}`);

  const html = generateReviewHtml({ metadata });
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
