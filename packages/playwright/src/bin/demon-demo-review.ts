#!/usr/bin/env bun
import { existsSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";

import {
  buildReviewPrompt,
  invokeClaude,
  parseReviewMetadata,
} from "../review.ts";

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

try {
  const basenames = webmFiles.map((f) => basename(f));
  const prompt = buildReviewPrompt(basenames);

  console.log("Invoking claude to generate review metadata...");
  const rawOutput = await invokeClaude(prompt, { agent });

  const metadata = parseReviewMetadata(rawOutput);
  const outputPath = join(resolved, "review-metadata.json");
  writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + "\n");
  console.log(`Review metadata written to ${outputPath}`);
} catch (err) {
  console.error(
    "Error generating review metadata:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
