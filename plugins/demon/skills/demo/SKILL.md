---
name: demo
description: Record a video demo of the feature you just built using Playwright
disable-model-invocation: true
allowed-tools: Bash(bunx playwright *), Write, Glob, Read, Grep
---

# /demo — Record a video demo

You are tasked with creating and running a Playwright demo that records a video of the feature the user just built.

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
- Contain a single `test()` block that walks through the feature
- Use realistic user interactions (click, fill, navigate)
- Add short `page.waitForTimeout()` pauses (500–1000ms) between actions so the video is watchable
- Keep it focused — under 30 seconds of runtime

### 5. Run the demo

```bash
bunx playwright test --config <config-path> <demo-file>
```

### 6. Report the result

After the test completes, find the `.webm` video file in the `outputDir` specified in the config (default `/tmp/demon-demos/`) and report its path to the user.

If the test failed, show the error output and offer to fix the demo file.
