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

test("tooltip flips above when target is near bottom edge", async ({
  page,
}) => {
  await page.goto(`data:text/html,
<html><body>
  <button id="btn" style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);">Bottom</button>
</body></html>`);

  await showCommentary(page, { selector: "#btn", text: "Flipped above" });

  const tooltip = page.locator(`#${TOOLTIP_ID}`);
  const btn = page.locator("#btn");
  const tooltipBox = await tooltip.boundingBox();
  const btnBox = await btn.boundingBox();

  expect(tooltipBox).toBeTruthy();
  expect(btnBox).toBeTruthy();
  // Tooltip bottom should be above or at the target top
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(btnBox!.y);
});

test("tooltip doesn't overflow right edge", async ({ page }) => {
  await page.goto(`data:text/html,
<html><body>
  <button id="btn" style="position:fixed;top:100px;right:10px;">Right</button>
</body></html>`);

  await showCommentary(page, { selector: "#btn", text: "Clamped right" });

  const tooltipBox = await page.locator(`#${TOOLTIP_ID}`).boundingBox();
  expect(tooltipBox).toBeTruthy();
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(1280);
});

test("tooltip doesn't overflow left edge", async ({ page }) => {
  await page.goto(`data:text/html,
<html><body>
  <button id="btn" style="position:fixed;top:100px;left:10px;">Left</button>
</body></html>`);

  await showCommentary(page, { selector: "#btn", text: "Clamped left" });

  const tooltipBox = await page.locator(`#${TOOLTIP_ID}`).boundingBox();
  expect(tooltipBox).toBeTruthy();
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
});

test("tooltip handles bottom-right corner target", async ({ page }) => {
  await page.goto(`data:text/html,
<html><body>
  <button id="btn" style="position:fixed;bottom:20px;right:10px;">Corner</button>
</body></html>`);

  await showCommentary(page, {
    selector: "#btn",
    text: "Bottom-right corner",
  });

  const tooltip = page.locator(`#${TOOLTIP_ID}`);
  const btn = page.locator("#btn");
  const tooltipBox = await tooltip.boundingBox();
  const btnBox = await btn.boundingBox();

  expect(tooltipBox).toBeTruthy();
  expect(btnBox).toBeTruthy();
  // Flipped above
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(btnBox!.y);
  // Right-clamped
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(1280);
});

test("default position: tooltip below target, horizontally centered", async ({
  page,
}) => {
  await page.goto(INLINE_HTML);

  await showCommentary(page, {
    selector: "#submit-btn",
    text: "Default position",
  });

  const tooltip = page.locator(`#${TOOLTIP_ID}`);
  const btn = page.locator("#submit-btn");
  const tooltipBox = await tooltip.boundingBox();
  const btnBox = await btn.boundingBox();

  expect(tooltipBox).toBeTruthy();
  expect(btnBox).toBeTruthy();
  // Below target
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(btnBox!.y + btnBox!.height);
  // Horizontally: tooltip center ≈ button center (within 2px tolerance)
  const tooltipCenter = tooltipBox!.x + tooltipBox!.width / 2;
  const btnCenter = btnBox!.x + btnBox!.width / 2;
  expect(Math.abs(tooltipCenter - btnCenter)).toBeLessThanOrEqual(2);
});
