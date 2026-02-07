#!/usr/bin/env bun
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { generateReview, discoverDemoFiles } from "../review-generator.ts";

let dir: string | undefined;
let agent: string | undefined;
let diffBase: string | undefined;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--agent") {
    agent = args[++i];
  } else if (args[i] === "--base") {
    diffBase = args[++i];
  } else if (!dir) {
    dir = args[i];
  }
}

if (!dir) {
  console.error("Usage: demon-demo-review [--agent <path>] [--base <ref>] <directory>");
  console.error("  Discovers .webm and .jsonl demo files in the given directory.");
  console.error("  --base <ref>  Base commit/branch for diff (auto-detects main/master if on feature branch)");
  process.exit(1);
}

const resolved = resolve(dir);

if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
  console.error(`Error: "${resolved}" is not a valid directory.`);
  process.exit(1);
}

// Discover and print demo files
const demoFiles = discoverDemoFiles(resolved);

if (demoFiles.length === 0) {
  console.error(`Error: No .webm or .jsonl files found in "${resolved}" or its subdirectories.`);
  process.exit(1);
}

for (const file of demoFiles) {
  console.log(file.path);
}

try {
  console.log("Invoking claude to generate review metadata...");
  const result = await generateReview({ directory: resolved, agent, diffBase });

  console.log(`Review metadata written to ${result.metadataPath}`);
  console.log(resolve(result.htmlPath));
} catch (err) {
  console.error(
    "Error generating review:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
