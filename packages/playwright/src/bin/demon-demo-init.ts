#!/usr/bin/env bun
import { existsSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const DEMO_CONFIG_FILENAME = "playwright.demo.config.ts";

const EXAMPLE_DEMO_TEMPLATE = `import { test } from "@playwright/test";
import { DemoRecorder } from "@demon-utils/playwright";
// You can also import hideCommentary to manually hide tooltips:
// import { hideCommentary } from "@demon-utils/playwright";

test("example demo", async ({ page }, testInfo) => {
  const demo = new DemoRecorder({ testStep: test.step });

  // Navigate to the starting page
  await demo.step(page, "Navigate to the application", { selector: "body" });
  await page.goto("/");
  await page.waitForTimeout(1000);

  // Demonstrate an interaction
  await demo.step(page, "Click a button or link", { selector: "body" });
  // await page.click("#my-button");
  await page.waitForTimeout(1000);

  // Save the demo steps metadata
  await demo.save(testInfo.outputDir);
});
`;

function findConfigDir(startDir: string): string | null {
  let current = resolve(startDir);
  const root = resolve("/");

  while (current !== root) {
    const configPath = join(current, DEMO_CONFIG_FILENAME);
    if (existsSync(configPath)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

const startPath = process.argv[2] ?? process.cwd();
const resolved = resolve(startPath);

const configDir = findConfigDir(resolved);

if (!configDir) {
  console.error(`Error: Could not find ${DEMO_CONFIG_FILENAME} in any parent directory of "${resolved}".`);
  process.exit(1);
}

const examplePath = join(configDir, "example.demo.ts");
writeFileSync(examplePath, EXAMPLE_DEMO_TEMPLATE);
console.log(examplePath);
