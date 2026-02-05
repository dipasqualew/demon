---
name: demo
description: Record a video demo of the feature you just built using Playwright
disable-model-invocation: true
allowed-tools: Bash(bunx playwright *), Bash(bunx demon-demo-review *), Write, Glob, Read, Grep
---

# /demo — Record a video demo

You are tasked with creating and running a Playwright demo that records a video of the feature the user just built.

## Guiding principles

* **Human-reviewable pacing.** The demo will be watched by a human. Proceed at a natural speed — use generous `waitForTimeout` pauses (800–1500ms) between actions so the reviewer has time to observe each state change before the next action occurs. Never rush through interactions.
* **Showcase every acceptance criterion.** Before writing the demo, review the issue or conversation context to identify all acceptance criteria and new capabilities. The demo must exercise each one. If an acceptance criterion is not demonstrated, the demo is incomplete.
* **Persuade the reviewer.** A `/demo-reviewer` skill will later evaluate this recording to determine whether the work is fully complete and meets expectations. Structure the demo so that every claimed capability is visibly proven — don't just navigate past a feature, interact with it and show the result.

## Steps

### 1. Find the demo config

Use `Glob` to find a file named `playwright.demo.config.ts` in the project.

If no config is found, tell the user they need to create one. Show them this example:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "/tmp/demon-demos",
  use: {
    baseURL: "http://localhost:3000",
    video: "on",
    viewport: { width: 1280, height: 720 },
  },
  reporter: [["list"]],
  projects: [{ name: "demo", use: { browserName: "chromium" } }],
});
```

Then stop.

### 2. Locate the demos directory

The demos directory is the directory containing the `playwright.demo.config.ts` file. For example, if the config is at `apps/web/playwright.demo.config.ts`, demos go in `apps/web/`.

### 3. Understand what was built

Read the conversation context to understand what feature was built during this session. Identify a short, descriptive kebab-case name for the feature (e.g. `user-login`, `dashboard-filters`).

### 4. Write the demo file

Write a single `<feature-name>.demo.ts` file in the same directory as the config. The file should:

- Import `{ test, expect }` from `@playwright/test`
- Import `{ DemoRecorder }` from `@demon-utils/playwright`
- Create a `DemoRecorder` instance with `{ testStep: test.step }`
- Use `demo.step(page, "description", { selector })` for each meaningful action to record timestamped steps
- Call `demo.save(testInfo.outputDir)` at the end to write `demo-steps.json`
- Use realistic user interactions (click, fill, navigate)
- Add generous `page.waitForTimeout()` pauses (800–1500ms) between actions so a human reviewer can follow along
- Keep it focused — under 30 seconds of runtime

Example structure:
```typescript
import { test, expect } from "@playwright/test";
import { DemoRecorder } from "@demon-utils/playwright";

test("feature demo", async ({ page }, testInfo) => {
  const demo = new DemoRecorder({ testStep: test.step });

  await demo.step(page, "Navigate to page", { selector: "body" });
  await page.goto("/feature");
  await page.waitForTimeout(1000);

  await demo.step(page, "Click the button", { selector: "#btn" });
  await page.click("#btn");

  await demo.save(testInfo.outputDir);
});
```

### 5. Run the demo

```bash
bunx playwright test --config <config-path> <demo-file>
```

### 6. Report the result

After the test completes, find the `.webm` video file in the `outputDir` specified in the config (default `/tmp/demon-demos/`) and report its path to the user.

If the test failed, show the error output and offer to fix the demo file.

### 7. Generate review page

Run `demon-demo-review` against the `outputDir` from the Playwright config (identified in Step 1):

```bash
bunx demon-demo-review <outputDir>
```

If the command succeeds, present the path to the generated `review.html` to the user.

If it fails (e.g. the `claude` CLI is not available), report the error but still show the raw `.webm` video paths from Step 6 as a fallback.
