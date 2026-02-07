---
name: demo
description: Record video demos of features using a manifest-driven flow (no subagents)
allowed-tools: Bash(git branch *), Bash(mkdir *), Bash(bunx -p @demon-utils/playwright demon-demo-review *), Write, Glob, Read
interpolations:
  - "! git rev-parse --show-toplevel"
  - "! git branch --show-current 2>/dev/null | tr '/' '-' || echo 'unknown'"
  - "! echo \"$(git rev-parse --show-toplevel)/.demoon/reviews/$(git branch --show-current 2>/dev/null | tr '/' '-' || echo 'unknown')\""
  - "! echo \"$(git rev-parse --show-toplevel)/.demoon/reviews/$(git branch --show-current 2>/dev/null | tr '/' '-' || echo 'unknown')/assets\""
  - "! echo \"$(git rev-parse --show-toplevel)/.demoon/reviews/$(git branch --show-current 2>/dev/null | tr '/' '-' || echo 'unknown')/tests\""
---

# /demo — Record video demos without subagents

You are tasked with creating demos that showcase the feature the user just built. This skill uses a simple, manifest-driven flow, and you perform all steps directly (no subagents).

## Phase 1: Planning (You do this)

### 1.1 Pre-computed paths

The following paths are pre-computed from the interpolations above (in order):
1. **REPO_ROOT**: The git repository root
2. **BRANCH_NAME**: Current branch name (slashes replaced with dashes)
3. **REVIEW_FOLDER**: `$REPO_ROOT/.demoon/reviews/$BRANCH_NAME`
4. **ASSETS_FOLDER**: `$REVIEW_FOLDER/assets` — where to put all outputs (videos, logs)
5. **TESTS_FOLDER**: `$REVIEW_FOLDER/tests` — where to put all demo test files

These folders are expected to exist. Create them if needed:

```bash
mkdir -p <REVIEW_FOLDER>/assets <REVIEW_FOLDER>/tests
```

### 1.2 Analyze context and create manifest

Review the conversation context to understand what feature was built. Identify:
- All acceptance criteria and new capabilities
- Which demos are needed (one demo per distinct capability)
- For each demo, whether it's `web-ux` (browser-based) or `log-based` (backend/CLI output)

Write the manifest to `<REVIEW_FOLDER>/demo-manifest.md`:

```markdown
# Demo Manifest: ${branch-name}

## Context
Brief description of the feature being demonstrated.

## Demos

### Demo 1: ${kebab-case-name}
- **Type:** web-ux | log-based
- **Description:** What this demo should show
- **Acceptance Criteria:**
  - Criterion 1
  - Criterion 2

### Demo 2: ${kebab-case-name}
...

## Configuration
- **Review Folder:** <REVIEW_FOLDER>
- **Assets Directory:** <ASSETS_FOLDER>
- **Tests Directory:** <TESTS_FOLDER>
- **Base URL:** http://localhost:3000
- **Playwright Config:** path/to/playwright.demo.config.ts (use Glob to find it)
```

Use `Glob` to find `playwright.demo.config.ts` and include its path in the Configuration section.

## Phase 2: Implementation (You do this)

Implement and run the demos yourself using the steps below. Do not spawn any subagents.

### 2.1 Project Setup Helper (optional)

Run `bunx -p @demon-utils/playwright demon-demo-init` once to create `example.demo.ts`. Read it to understand the structure and helpers.

### 2.2 For web-ux demos (Playwright)

Create `.demo.ts` files in the **Tests Directory** from the manifest. Example pattern:

```typescript
import { test } from "@playwright/test";
import { DemoRecorder } from "@demon-utils/playwright";

test("feature demo", async ({ page }, testInfo) => {
  const demo = new DemoRecorder({ testStep: test.step });

  await demo.step(page, "Navigate to the application", { selector: "body" });
  await page.goto("/");
  await page.waitForTimeout(1000);

  await demo.step(page, "Click the submit button", { selector: "form" });
  await page.click("#submit");
  await page.waitForTimeout(1000);

  await demo.save(testInfo.outputDir);
});
```

Key points:
- Use `demo.step(page, "description", { selector })` for each meaningful action
- The `selector` is a CSS selector for positioning tooltips — use broad selectors (e.g., `body`, `nav`, `form`)
- Add generous `page.waitForTimeout()` pauses (800–1500ms) between actions
- Keep each demo under ~30 seconds

Run a demo with:

```bash
bunx playwright test --config <config-path> --output <assets-directory> <demo-file>
```

### 2.3 For log-based demos

Create `.jsonl` files in the **Assets Directory** with one JSON object per line. Use `demon__highlight` to emphasize key lines or add inline commentary.

Example lines:

```jsonl
{"timestamp":"2024-01-15T10:30:00.123Z","level":"info","message":"Starting migration..."}
{"timestamp":"2024-01-15T10:30:01.001Z","level":"info","message":"Applied migration 001","demon__highlight":"Schema updated"}
```

Field reference:
- `timestamp`: ISO 8601 timestamp
- `level`: `debug` | `info` | `warn` | `error`
- `message`: main log message
- `demon__highlight`: `true` for highlight, or a string for inline commentary

### 2.4 Reporting

When done, list:
1. Demo test files created (paths to `.demo.ts`)
2. Artifact files generated in the Assets Directory (`.webm` for web-ux, `.jsonl` for log-based)
3. Any errors encountered

## Phase 3: Finalization (You do this)

Generate the review page against the review folder (which contains both `assets` and `tests`):

```bash
bunx -p @demon-utils/playwright demon-demo-review <REVIEW_FOLDER>
```

If successful, present the path to the generated `review.html`.
If it fails, report the error and show raw artifact paths as a fallback.

