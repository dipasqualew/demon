import { test, expect } from "@playwright/test";

import type { CodeReview, ReviewMetadata } from "./review-types.ts";
import { generateReviewHtml } from "./html-generator.ts";

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
  return generateReviewHtml({ metadata: makeMetadata(overrides) });
}

test.describe("feedback tab e2e", () => {
  test.describe("tab navigation", () => {
    test("clicking Feedback tab shows feedback panel and hides others", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('[data-tab="feedback"]');

      await expect(page.locator("#tab-feedback")).toBeVisible();
      await expect(page.locator("#tab-summary")).not.toBeVisible();
      await expect(page.locator("#tab-demos")).not.toBeVisible();
    });

    test("feedback panel is not visible by default", async ({ page }) => {
      await page.setContent(generatePage());

      await expect(page.locator("#tab-feedback")).not.toBeVisible();
      await expect(page.locator("#tab-summary")).toBeVisible();
    });
  });

  test.describe("issue + buttons", () => {
    test("clicking + button adds issue to feedback list", async ({ page }) => {
      await page.setContent(generatePage());

      await page.click('[data-tab="feedback"]');
      await expect(page.locator("#feedback-list li")).toHaveCount(0);

      await page.click('[data-tab="summary"]');
      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');

      await page.click('[data-tab="feedback"]');
      await expect(page.locator("#feedback-list li")).toHaveCount(1);
      await expect(page.locator("#feedback-list li span").first()).toHaveText(
        "Memory leak in handler",
      );
    });

    test("clicking multiple + buttons adds multiple items", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('.feedback-add-issue[data-issue="Missing edge case test"]');
      await page.click('.feedback-add-issue[data-issue="Rename variable for clarity"]');

      await page.click('[data-tab="feedback"]');
      await expect(page.locator("#feedback-list li")).toHaveCount(3);
    });

    test("clicking same + button twice does not duplicate", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');

      await page.click('[data-tab="feedback"]');
      await expect(page.locator("#feedback-list li")).toHaveCount(1);
    });
  });

  test.describe("feedback preview", () => {
    test("preview updates when items are added", async ({ page }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('[data-tab="feedback"]');

      await expect(page.locator("#feedback-preview")).toContainText(
        "1. Address: Memory leak in handler",
      );
    });

    test("preview shows numbered list for multiple items", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('.feedback-add-issue[data-issue="Missing edge case test"]');
      await page.click('[data-tab="feedback"]');

      const preview = page.locator("#feedback-preview");
      await expect(preview).toContainText("1. Address: Memory leak in handler");
      await expect(preview).toContainText(
        "2. Address: Missing edge case test",
      );
    });

    test("preview includes general feedback from textarea", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('[data-tab="feedback"]');
      await page.fill("#feedback-general", "Overall good work, minor fixes needed");

      await expect(page.locator("#feedback-preview")).toContainText(
        "General feedback:",
      );
      await expect(page.locator("#feedback-preview")).toContainText(
        "Overall good work, minor fixes needed",
      );
    });

    test("preview combines items and general feedback", async ({ page }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('[data-tab="feedback"]');
      await page.fill("#feedback-general", "Please address ASAP");

      const preview = page.locator("#feedback-preview");
      await expect(preview).toContainText("1. Address: Memory leak in handler");
      await expect(preview).toContainText("General feedback:");
      await expect(preview).toContainText("Please address ASAP");
    });
  });

  test.describe("remove feedback items", () => {
    test("clicking X removes item from list and preview", async ({ page }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('.feedback-add-issue[data-issue="Missing edge case test"]');
      await page.click('[data-tab="feedback"]');

      await expect(page.locator("#feedback-list li")).toHaveCount(2);

      await page.click("#feedback-list .feedback-remove >> nth=0");

      await expect(page.locator("#feedback-list li")).toHaveCount(1);
      await expect(page.locator("#feedback-list li span").first()).toHaveText(
        "Missing edge case test",
      );
      await expect(page.locator("#feedback-preview")).not.toContainText(
        "Memory leak in handler",
      );
    });
  });

  test.describe("copy button", () => {
    test("copy button changes text to Copied! on click", async ({ page }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('[data-tab="feedback"]');

      // Grant clipboard permissions
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      await page.click("#feedback-copy");
      await expect(page.locator("#feedback-copy")).toHaveText("Copied!");
    });

    test("copy button reverts to original text after delay", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');
      await page.click('[data-tab="feedback"]');

      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      await page.click("#feedback-copy");
      await expect(page.locator("#feedback-copy")).toHaveText("Copied!");

      await expect(page.locator("#feedback-copy")).toHaveText(
        "Copy to clipboard",
        { timeout: 3000 },
      );
    });
  });

  test.describe("text selection floating button", () => {
    test("floating button appears when selecting text in summary tab", async ({
      page,
    }) => {
      await page.setContent(generatePage());

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
      await page.setContent(generatePage());

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

      await page.click('[data-tab="feedback"]');
      await expect(page.locator("#feedback-list li")).toHaveCount(1);
      await expect(page.locator("#feedback-list li span").first()).toHaveText(
        "Good changes overall",
      );
    });

    test("floating button hides when clicking elsewhere", async ({ page }) => {
      await page.setContent(generatePage());

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
      await page.click("header");

      await expect(page.locator("#feedback-selection-btn")).not.toBeVisible();
    });
  });

  test.describe("no review", () => {
    test("no feedback elements when review is absent", async ({ page }) => {
      await page.setContent(generatePage({ review: undefined }));

      await expect(page.locator('[data-tab="feedback"]')).toHaveCount(0);
      await expect(page.locator("#tab-feedback")).toHaveCount(0);
      await expect(page.locator("#feedback-selection-btn")).toHaveCount(0);
      await expect(page.locator(".feedback-add-issue")).toHaveCount(0);
    });
  });

  test.describe("feedback persists across tab switches", () => {
    test("feedback items survive switching tabs", async ({ page }) => {
      await page.setContent(generatePage());

      await page.click('.feedback-add-issue[data-issue="Memory leak in handler"]');

      await page.click('[data-tab="feedback"]');
      await expect(page.locator("#feedback-list li")).toHaveCount(1);

      // Switch to demos and back
      await page.click('[data-tab="demos"]');
      await page.click('[data-tab="feedback"]');

      await expect(page.locator("#feedback-list li")).toHaveCount(1);
      await expect(page.locator("#feedback-list li span").first()).toHaveText(
        "Memory leak in handler",
      );
    });

    test("general feedback text persists across tab switches", async ({
      page,
    }) => {
      await page.setContent(generatePage());

      await page.click('[data-tab="feedback"]');
      await page.fill("#feedback-general", "Some general notes");

      await page.click('[data-tab="demos"]');
      await page.click('[data-tab="feedback"]');

      await expect(page.locator("#feedback-general")).toHaveValue(
        "Some general notes",
      );
    });
  });
});
