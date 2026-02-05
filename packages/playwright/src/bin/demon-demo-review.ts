#!/usr/bin/env bun
import { existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const dir = process.argv[2];

if (!dir) {
  console.error("Usage: demon-demo-review <directory>");
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
