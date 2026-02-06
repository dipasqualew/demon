import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import type { CodeReview, ReviewMetadata } from "./review-types.ts";

interface ReviewAppData {
  metadata: ReviewMetadata;
  title: string;
  videos: Record<string, string>;
  logs?: Record<string, string>;
}

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const templatePath = join(currentDir, "..", "dist", "review-template.html");
const tempDir = mkdtempSync(join(tmpdir(), "review-test-"));

function getTemplate(): string {
  return readFileSync(templatePath, "utf-8");
}

function makeReview(overrides?: Partial<CodeReview>): CodeReview {
  return {
    summary: "Good changes overall",
    highlights: ["Clean implementation", "Good test coverage"],
    verdict: "approve",
    verdictReason: "No major issues found",
    issues: [
      { severity: "major", description: "Memory leak in handler" },
      { severity: "minor", description: "Missing edge case test" },
      { severity: "nit", description: "Rename variable for clarity" },
    ],
    ...overrides,
  };
}

function makeMetadata(overrides?: Partial<ReviewMetadata>): ReviewMetadata {
  return {
    demos: [
      {
        file: "login-flow.webm",
        type: "web-ux",
        summary: "Shows the login flow end to end",
        steps: [
          { timestampSeconds: 0, text: "Page loads" },
          { timestampSeconds: 5, text: "User types credentials" },
        ],
      },
    ],
    review: makeReview(),
    ...overrides,
  };
}

interface GeneratePageOptions {
  metadataOverrides?: Partial<ReviewMetadata>;
  logs?: Record<string, string>;
}

function generatePage(options: GeneratePageOptions | Partial<ReviewMetadata> = {}): string {
  // Support legacy signature (just metadata overrides)
  const isLegacy = !('metadataOverrides' in options) && !('logs' in options);
  const metadataOverrides = isLegacy ? options as Partial<ReviewMetadata> : (options as GeneratePageOptions).metadataOverrides;
  const logs = isLegacy ? undefined : (options as GeneratePageOptions).logs;

  const appData: ReviewAppData = {
    metadata: makeMetadata(metadataOverrides),
    title: "Demo Review",
    videos: {},
    logs,
  };

  const template = getTemplate();
  const html = template.replace('"{{__INJECT_REVIEW_DATA__}}"', JSON.stringify(appData));

  // Write to temp file and return file URL
  const tempFile = join(tempDir, `test-${Date.now()}.html`);
  writeFileSync(tempFile, html);
  return `file://${tempFile}`;
}

// Helper to click tab via JavaScript (Vuetify tabs need JS click for proper event handling)
async function clickTab(page: Page, tabId: string) {
  await page.locator(`[data-tab="${tabId}"]`).evaluate(el => (el as HTMLElement).click());
  await page.waitForTimeout(100);
}

test.describe("feedback tab e2e", () => {
  test.describe("tab navigation", () => {
    test("clicking Feedback tab shows feedback panel and hides others", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "feedback");

      await expect(page.locator("#tab-feedback")).toBeVisible();
      await expect(page.locator("#tab-summary")).not.toBeVisible();
      await expect(page.locator("#tab-demos")).not.toBeVisible();
    });

    test("feedback panel is not visible by default", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await expect(page.locator("#tab-feedback")).not.toBeVisible();
      await expect(page.locator("#tab-summary")).toBeVisible();
    });
  });

  test.describe("issue + buttons", () => {
    test("clicking + button adds issue to feedback list", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "feedback");
      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(0);

      await clickTab(page, "summary");
      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');

      await clickTab(page, "feedback");
      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="feedback-item"]').first()).toContainText(
        "Memory leak in handler",
      );
    });

    test("clicking multiple + buttons adds multiple items", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await page.click('[data-testid="issue-add-feedback"][data-issue="Missing edge case test"]');
      await page.click('[data-testid="issue-add-feedback"][data-issue="Rename variable for clarity"]');

      await clickTab(page, "feedback");
      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(3);
    });

    test("clicking same + button twice does not duplicate", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');

      await clickTab(page, "feedback");
      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(1);
    });
  });

  test.describe("feedback preview", () => {
    test("preview updates when items are added", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await clickTab(page, "feedback");

      await expect(page.locator("#feedback-preview")).toContainText(
        "1. Address: Memory leak in handler",
      );
    });

    test("preview shows numbered list for multiple items", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await page.click('[data-testid="issue-add-feedback"][data-issue="Missing edge case test"]');
      await clickTab(page, "feedback");

      const preview = page.locator("#feedback-preview");
      await expect(preview).toContainText("1. Address: Memory leak in handler");
      await expect(preview).toContainText(
        "2. Address: Missing edge case test",
      );
    });

    test("preview includes general feedback from textarea", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "feedback");
      await page.locator('[data-testid="feedback-general"] textarea:not([readonly])').fill("Overall good work, minor fixes needed");

      await expect(page.locator("#feedback-preview")).toContainText(
        "General feedback:",
      );
      await expect(page.locator("#feedback-preview")).toContainText(
        "Overall good work, minor fixes needed",
      );
    });

    test("preview combines items and general feedback", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await clickTab(page, "feedback");
      await page.locator('[data-testid="feedback-general"] textarea:not([readonly])').fill("Please address ASAP");

      const preview = page.locator("#feedback-preview");
      await expect(preview).toContainText("1. Address: Memory leak in handler");
      await expect(preview).toContainText("General feedback:");
      await expect(preview).toContainText("Please address ASAP");
    });
  });

  test.describe("remove feedback items", () => {
    test("clicking X removes item from list and preview", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await page.click('[data-testid="issue-add-feedback"][data-issue="Missing edge case test"]');
      await clickTab(page, "feedback");

      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(2);

      await page.locator('[data-testid="feedback-remove"]').first().click();

      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="feedback-item"]').first()).toContainText(
        "Missing edge case test",
      );
      await expect(page.locator("#feedback-preview")).not.toContainText(
        "Memory leak in handler",
      );
    });
  });

  test.describe("copy button", () => {
    test("copy button changes text to Copied! on click", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await clickTab(page, "feedback");

      // Grant clipboard permissions
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      await page.click("#feedback-copy");
      await expect(page.locator("#feedback-copy")).toContainText("Copied!");
    });

    test("copy button reverts to original text after delay", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');
      await clickTab(page, "feedback");

      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      await page.click("#feedback-copy");
      await expect(page.locator("#feedback-copy")).toContainText("Copied!");

      await expect(page.locator("#feedback-copy")).toContainText(
        "Copy to clipboard",
        { timeout: 3000 },
      );
    });
  });

  test.describe("text selection floating button", () => {
    test("floating button appears when selecting text in summary tab", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await expect(page.locator("#feedback-selection-btn")).not.toBeVisible();

      // Select text within the summary tab review body
      const summaryText = page.locator(".review-body p").first();
      await summaryText.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      });

      // Trigger mouseup to activate the button
      await summaryText.dispatchEvent("mouseup", { bubbles: true });

      await expect(page.locator("#feedback-selection-btn")).toBeVisible({
        timeout: 2000,
      });
    });

    test("clicking floating button adds selected text to feedback", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      // Select the summary text
      const summaryText = page.locator(".review-body p").first();
      await summaryText.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await summaryText.dispatchEvent("mouseup", { bubbles: true });

      await expect(page.locator("#feedback-selection-btn")).toBeVisible({
        timeout: 2000,
      });

      // Click via JS since synthetic mouseup positions the button off-viewport
      await page.locator("#feedback-selection-btn").evaluate((el: HTMLElement) => el.click());

      await expect(page.locator("#feedback-selection-btn")).not.toBeVisible();

      await clickTab(page, "feedback");
      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="feedback-item"]').first()).toContainText(
        "Good changes overall",
      );
    });

    test("floating button hides when clicking elsewhere", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      const summaryText = page.locator(".review-body p").first();
      await summaryText.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await summaryText.dispatchEvent("mouseup", { bubbles: true });

      await expect(page.locator("#feedback-selection-btn")).toBeVisible({
        timeout: 2000,
      });

      // Click elsewhere
      await page.locator('[data-testid="review-header"]').click({ force: true });

      await expect(page.locator("#feedback-selection-btn")).not.toBeVisible();
    });
  });

  test.describe("no review", () => {
    test("no feedback elements when review is absent", async ({ page }) => {
      await page.goto(generatePage({ review: undefined }));
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await expect(page.locator('[data-tab="feedback"]')).toHaveCount(0);
      await expect(page.locator("#tab-feedback")).toHaveCount(0);
      await expect(page.locator("#feedback-selection-btn")).toHaveCount(0);
      await expect(page.locator('[data-testid="issue-add-feedback"]')).toHaveCount(0);
    });
  });

  test.describe("feedback persists across tab switches", () => {
    test("feedback items survive switching tabs", async ({ page }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await page.click('[data-testid="issue-add-feedback"][data-issue="Memory leak in handler"]');

      await clickTab(page, "feedback");
      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(1);

      // Switch to demos and back
      await clickTab(page, "demos");
      await clickTab(page, "feedback");

      await expect(page.locator('[data-testid="feedback-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="feedback-item"]').first()).toContainText(
        "Memory leak in handler",
      );
    });

    test("general feedback text persists across tab switches", async ({
      page,
    }) => {
      await page.goto(generatePage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "feedback");
      await page.locator('[data-testid="feedback-general"] textarea:not([readonly])').fill("Some general notes");

      await clickTab(page, "demos");
      await clickTab(page, "feedback");

      await expect(page.locator('[data-testid="feedback-general"] textarea:not([readonly])')).toHaveValue(
        "Some general notes",
      );
    });
  });
});

test.describe("log-based demos e2e", () => {
  const mockLogContent = [
    '{"timestamp":"2024-01-15T10:30:00.123Z","level":"info","message":"Starting migration..."}',
    '{"timestamp":"2024-01-15T10:30:01.001Z","level":"info","message":"Applied migration 001","demon__highlight":true}',
    '{"timestamp":"2024-01-15T10:30:02.001Z","level":"warn","message":"Skipping migration 002"}',
    '{"timestamp":"2024-01-15T10:30:03.001Z","level":"error","message":"Migration failed"}',
    '{"timestamp":"2024-01-15T10:30:04.001Z","level":"info","message":"Complete","demon__highlight":"This is the commentary text"}',
  ].join("\n");

  function generateLogPage() {
    return generatePage({
      metadataOverrides: {
        demos: [
          {
            file: "db-migration.jsonl",
            type: "log-based",
            summary: "Database migration script execution",
            steps: [],
          },
        ],
      },
      logs: {
        "db-migration.jsonl": mockLogContent,
      },
    });
  }

  function generateMixedPage() {
    return generatePage({
      metadataOverrides: {
        demos: [
          {
            file: "login-flow.webm",
            type: "web-ux",
            summary: "Shows the login flow end to end",
            steps: [
              { timestampSeconds: 0, text: "Page loads" },
              { timestampSeconds: 5, text: "User types credentials" },
            ],
          },
          {
            file: "db-migration.jsonl",
            type: "log-based",
            summary: "Database migration script execution",
            steps: [],
          },
        ],
      },
      logs: {
        "db-migration.jsonl": mockLogContent,
      },
    });
  }

  test.describe("log viewer rendering", () => {
    test("displays log viewer for log-based demo", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      await expect(page.locator('[data-testid="log-viewer"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-player"]')).not.toBeVisible();
    });

    test("displays log lines with line numbers", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      const logViewer = page.locator('[data-testid="log-viewer"]');
      await expect(logViewer).toBeVisible();

      // Check that log lines are present
      const logLines = logViewer.locator(".log-line");
      await expect(logLines).toHaveCount(5);

      // Check line numbers
      await expect(logLines.nth(0).locator(".line-number")).toContainText("1");
      await expect(logLines.nth(4).locator(".line-number")).toContainText("5");
    });

    test("displays log messages", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      const logViewer = page.locator('[data-testid="log-viewer"]');
      await expect(logViewer).toContainText("Starting migration...");
      await expect(logViewer).toContainText("Applied migration 001");
      await expect(logViewer).toContainText("Migration failed");
    });

    test("displays level chips with correct colors", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      const logViewer = page.locator('[data-testid="log-viewer"]');

      // Check for level chips
      await expect(logViewer.locator(".level-chip").filter({ hasText: "INFO" })).toHaveCount(3);
      await expect(logViewer.locator(".level-chip").filter({ hasText: "WARN" })).toHaveCount(1);
      await expect(logViewer.locator(".level-chip").filter({ hasText: "ERROR" })).toHaveCount(1);
    });

    test("highlights lines with demon__highlight: true", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      const logViewer = page.locator('[data-testid="log-viewer"]');
      const highlightedLines = logViewer.locator(".log-line--highlighted");

      // Two lines have demon__highlight
      await expect(highlightedLines).toHaveCount(2);
    });

    test("displays inline commentary for string highlights", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      const logViewer = page.locator('[data-testid="log-viewer"]');
      const commentary = logViewer.locator(".commentary");

      await expect(commentary).toHaveCount(1);
      await expect(commentary).toContainText("This is the commentary text");
    });
  });

  test.describe("steps list visibility", () => {
    test("hides steps list for log-based demo", async ({ page }) => {
      await page.goto(generateLogPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      await expect(page.locator('[data-testid="log-viewer"]')).toBeVisible();
      await expect(page.locator('[data-testid="steps-list"]')).not.toBeVisible();
    });

    test("shows steps list for web-ux demo", async ({ page }) => {
      await page.goto(generateMixedPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      // First demo is web-ux
      await expect(page.locator('[data-testid="video-player"]')).toBeVisible();
      await expect(page.locator('[data-testid="steps-list"]')).toBeVisible();
    });
  });

  test.describe("switching between demo types", () => {
    test("switches from web-ux to log-based demo", async ({ page }) => {
      await page.goto(generateMixedPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      // Initially shows video player (first demo is web-ux)
      await expect(page.locator('[data-testid="video-player"]')).toBeVisible();
      await expect(page.locator('[data-testid="log-viewer"]')).not.toBeVisible();

      // Click on the second demo (log-based)
      await page.locator('[data-testid="demo-list"] [data-testid="demo-item"]').nth(1).click();

      // Should now show log viewer
      await expect(page.locator('[data-testid="log-viewer"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-player"]')).not.toBeVisible();
    });

    test("switches from log-based to web-ux demo", async ({ page }) => {
      await page.goto(generateMixedPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      // Click on the second demo (log-based) first
      await page.locator('[data-testid="demo-list"] [data-testid="demo-item"]').nth(1).click();
      await expect(page.locator('[data-testid="log-viewer"]')).toBeVisible();

      // Click back to first demo (web-ux)
      await page.locator('[data-testid="demo-list"] [data-testid="demo-item"]').nth(0).click();

      // Should show video player again
      await expect(page.locator('[data-testid="video-player"]')).toBeVisible();
      await expect(page.locator('[data-testid="log-viewer"]')).not.toBeVisible();
    });

    test("updates summary text when switching demos", async ({ page }) => {
      await page.goto(generateMixedPage());
      await page.waitForSelector("#app .v-application", { timeout: 5000 });

      await clickTab(page, "demos");

      // Check initial summary
      await expect(page.locator("#summary-text")).toContainText("Shows the login flow");

      // Switch to log-based demo
      await page.locator('[data-testid="demo-list"] [data-testid="demo-item"]').nth(1).click();

      // Check summary updated
      await expect(page.locator("#summary-text")).toContainText("Database migration");
    });
  });
});
