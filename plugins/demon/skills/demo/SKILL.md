---
name: demo
description: Record video demos of features using a manifest-driven subagent
disable-model-invocation: true
allowed-tools: Bash(git branch *), Bash(mkdir *), Bash(bunx demon-demo-review *), Write, Glob, Read, Task
interpolations:
  - "! git branch --show-current 2>/dev/null | tr '/' '-' || echo 'unknown'"
---

# /demo — Record video demos with manifest-driven subagent

You are tasked with creating demos that showcase the feature the user just built. This skill uses a three-phase architecture to optimize token usage.

## Phase 1: Planning (You do this)

### 1.1 Get branch name

The current branch name (with slashes replaced by dashes) is available from the interpolation output above. Use this as `${branch-name}` in paths below.

### 1.2 Create .demon directory

```bash
mkdir -p .demon
```

### 1.3 Analyze context and create manifest

Review the conversation context to understand what feature was built. Identify:
- All acceptance criteria and new capabilities
- Which demos are needed (one demo per distinct capability)
- For each demo, whether it's `web-ux` (browser-based) or `log-based` (backend/CLI output)

Write the manifest to `.demon/${branch-name}-demo-manifest.md`:

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
- **Output Directory:** /tmp/demon-demos
- **Base URL:** http://localhost:3000
- **Playwright Config:** path/to/playwright.demo.config.ts (use Glob to find it)
```

Use `Glob` to find `playwright.demo.config.ts` and include its path in the Configuration section.

## Phase 2: Implementation (Subagent does this)

Use the `Task` tool to spawn a subagent that implements and runs the demos:

```
Task(
  subagent_type: "general-purpose",
  description: "Implement and run demos from manifest",
  prompt: <see below>
)
```

### Subagent Prompt

Use exactly this prompt, replacing `${manifest-path}` with the actual path:

---

You are implementing video demos based on a manifest. Read the manifest at `${manifest-path}` to understand what demos to create.

## Setup

First, run `bunx demon-demo-init` to create `example.demo.ts`, then read it to understand the project structure.

## Guiding Principles

* **Human-reviewable pacing.** The demo will be watched by a human. Proceed at a natural speed — use generous `waitForTimeout` pauses (800–1500ms) between actions so the reviewer has time to observe each state change before the next action occurs. Never rush through interactions.
* **Showcase every acceptance criterion.** The demo must exercise each acceptance criterion listed in the manifest. If an acceptance criterion is not demonstrated, the demo is incomplete.
* **Persuade the reviewer.** A `/demo-reviewer` skill will later evaluate this recording to determine whether the work is fully complete and meets expectations. Structure the demo so that every claimed capability is visibly proven — don't just navigate past a feature, interact with it and show the result.

## For web-ux Demos

### DemoRecorder API

```typescript
import { test } from "@playwright/test";
import { DemoRecorder } from "@demon-utils/playwright";

test("feature demo", async ({ page }, testInfo) => {
  const demo = new DemoRecorder({ testStep: test.step });

  // Each step shows a tooltip at the selector location
  await demo.step(page, "Navigate to the application", { selector: "body" });
  await page.goto("/");
  await page.waitForTimeout(1000);

  // The selector is a CSS selector for positioning tooltips
  // Use broad selectors like "body", "nav", "form", "#main-content"
  await demo.step(page, "Click the submit button", { selector: "form" });
  await page.click("#submit");
  await page.waitForTimeout(1000);

  // Save demo metadata at the end
  await demo.save(testInfo.outputDir);
});
```

### Key Points

- Use `demo.step(page, "description", { selector })` for each meaningful action
- The `selector` is a **CSS selector** for positioning tooltips — use broad selectors
- Add generous `page.waitForTimeout()` pauses (800–1500ms) between actions
- Call `demo.save(testInfo.outputDir)` at the end
- Keep it focused — under 30 seconds of runtime

### Running web-ux Demos

```bash
bunx playwright test --config <config-path> <demo-file>
```

## For log-based Demos

For backend-heavy features with no visible UI, create log-based demos that display command output as highlighted logs with inline commentary.

### JSONL Format

Create a `.jsonl` file where each line is valid JSON:

```jsonl
{"timestamp":"2024-01-15T10:30:00.123Z","level":"info","message":"Starting migration..."}
{"timestamp":"2024-01-15T10:30:01.001Z","level":"info","message":"Applied migration 001"}
```

### Adding Highlights

Use `demon__highlight` annotations to emphasize key lines:

- `"demon__highlight": true` — highlights the line with a yellow accent
- `"demon__highlight": "Your commentary here"` — highlights AND shows inline commentary

```jsonl
{"timestamp":"...","level":"info","message":"Migration complete","demon__highlight":"Database schema updated successfully"}
```

### Field Reference

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 timestamp (displayed in grey) |
| `level` | Log level: `debug`, `info`, `warn`, `error` (shown as colored chip) |
| `message` | Main log message text |
| `demon__highlight` | `true` for highlighting, or a string for inline commentary |

### Placement

Place `.jsonl` files in the same output directory specified in the manifest Configuration section.

## After Implementation

Report back with:
1. List of demo files created (paths)
2. List of artifact files generated (.webm for web-ux, .jsonl for log-based)
3. Any errors encountered

---

## Phase 3: Finalization (You do this)

After the subagent completes:

### 3.1 Generate review page

Run `demon-demo-review` against the output directory from the manifest:

```bash
bunx demon-demo-review <outputDir>
```

### 3.2 Report to user

If successful, present the path to the generated `review.html` to the user.

If it fails, report the error but still show the raw artifact paths (.webm/.jsonl) as a fallback.
