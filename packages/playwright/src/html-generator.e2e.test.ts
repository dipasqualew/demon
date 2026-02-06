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

function generatePage(overrides?: Partial<ReviewMetadata>): string {
  const appData: ReviewAppData = {
    metadata: makeMetadata(overrides),
    title: "Demo Review",
    videos: {},
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
