---
name: demo
description: Record a video demo of the feature you just built using Playwright
disable-model-invocation: true
allowed-tools: Bash(bunx playwright *), Bash(bunx demon-demo-review *), Bash(bunx demon-demo-init *), Write, Glob, Read, Grep
interpolations:
  - "! bunx demon-demo-init 2>/dev/null || true"
---

# /demo — Record a video demo

You are tasked with creating and running a Playwright demo that records a video of the feature the user just built.

## Guiding principles

* **Human-reviewable pacing.** The demo will be watched by a human. Proceed at a natural speed — use generous `waitForTimeout` pauses (800–1500ms) between actions so the reviewer has time to observe each state change before the next action occurs. Never rush through interactions.
* **Showcase every acceptance criterion.** Before writing the demo, review the issue or conversation context to identify all acceptance criteria and new capabilities. The demo must exercise each one. If an acceptance criterion is not demonstrated, the demo is incomplete.
* **Persuade the reviewer.** A `/demo-reviewer` skill will later evaluate this recording to determine whether the work is fully complete and meets expectations. Structure the demo so that every claimed capability is visibly proven — don't just navigate past a feature, interact with it and show the result.

## Steps

### 1. Locate the example demo

If `demon-demo-init` ran successfully (see the interpolation output above), it created `example.demo.ts` in the demos directory.

Use `Glob` to find `example.demo.ts`. This file shows the DemoRecorder API and marks where demos should be created.

If no `example.demo.ts` is found, look for `playwright.demo.config.ts`. If that's also missing, tell the user they need to create a demo config and stop.

### 2. Understand what was built

Read the conversation context to understand what feature was built during this session. Identify a short, descriptive kebab-case name for the feature (e.g. `user-login`, `dashboard-filters`).

### 3. Write the demo file

Read `example.demo.ts` to understand the DemoRecorder API. Then write a `<feature-name>.demo.ts` file in the same directory.

Key points:
- Use `demo.step(page, "description", { selector })` for each meaningful action
- The `selector` is a **CSS selector** for positioning tooltips — use broad selectors like `"body"`, `"nav"`, `"form"`
- Add generous `page.waitForTimeout()` pauses (800–1500ms) between actions
- Call `demo.save(testInfo.outputDir)` at the end
- Keep it focused — under 30 seconds of runtime

### 4. Run the demo

```bash
bunx playwright test --config <config-path> <demo-file>
```

### 5. Report the result

After the test completes, find the `.webm` video file in the `outputDir` specified in the config (default `/tmp/demon-demos/`) and report its path to the user.

If the test failed, show the error output and offer to fix the demo file.

### 6. Generate review page

Run `demon-demo-review` against the `outputDir` from the Playwright config (identified in Step 1). The tool automatically searches subdirectories for `.webm` files (Playwright creates per-test subdirectories under `outputDir`).

```bash
bunx demon-demo-review <outputDir>
```

If the command succeeds, present the path to the generated `review.html` to the user.

If it fails (e.g. the `claude` CLI is not available), report the error but still show the raw `.webm` video paths from Step 6 as a fallback.
