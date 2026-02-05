import { test, expect } from "@playwright/test";

import { showCommentary, hideCommentary } from "./commentary.ts";

const TOOLTIP_ID = "demon-commentary-tooltip";

const INLINE_HTML = `data:text/html,
<html>
<body>
  <button id="submit-btn" style="margin: 100px;">Submit</button>
</body>
</html>`;

test("showCommentary injects a tooltip near the target element", async ({
  page,
}) => {
  await page.goto(INLINE_HTML);

  await showCommentary(page, {
    selector: "#submit-btn",
    text: "Now we submit the form",
  });

  const tooltip = page.locator(`#${TOOLTIP_ID}`);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("Now we submit the form");
});

test("hideCommentary removes the tooltip with animation", async ({ page }) => {
  await page.goto(INLINE_HTML);

  await showCommentary(page, {
    selector: "#submit-btn",
    text: "This will disappear",
  });

  await expect(page.locator(`#${TOOLTIP_ID}`)).toBeVisible();

  await hideCommentary(page);

  await expect(page.locator(`#${TOOLTIP_ID}`)).toHaveCount(0);
});

test("showCommentary replaces an existing tooltip", async ({ page }) => {
  await page.goto(INLINE_HTML);

  await showCommentary(page, {
    selector: "#submit-btn",
    text: "First message",
  });

  await showCommentary(page, {
    selector: "#submit-btn",
    text: "Second message",
  });

  const tooltips = page.locator(`#${TOOLTIP_ID}`);
  await expect(tooltips).toHaveCount(1);
  await expect(tooltips).toHaveText("Second message");
});

test("showCommentary throws for missing selector", async ({ page }) => {
  await page.goto(INLINE_HTML);

  await expect(
    showCommentary(page, {
      selector: "#nonexistent",
      text: "Should fail",
    }),
  ).rejects.toThrow();
});
