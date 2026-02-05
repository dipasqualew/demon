import type { Page } from "@playwright/test";

export interface ShowCommentaryOptions {
  selector: string;
  text: string;
}

const TOOLTIP_ID = "demon-commentary-tooltip";

export async function showCommentary(
  page: Page,
  options: ShowCommentaryOptions,
): Promise<void> {
  await page.evaluate(
    ({ selector, text, tooltipId }) => {
      const target = document.querySelector(selector);
      if (!target) {
        throw new Error(
          `demon commentary: element not found for selector "${selector}"`,
        );
      }

      // Remove any existing tooltip
      document.getElementById(tooltipId)?.remove();

      const rect = target.getBoundingClientRect();

      const tooltip = document.createElement("div");
      tooltip.id = tooltipId;
      tooltip.textContent = text;

      const style = document.createElement("style");
      style.setAttribute("data-demon-commentary", "");
      style.textContent = `
        @keyframes demon-commentary-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes demon-commentary-out {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(8px);
          }
        }
        #${tooltipId} {
          position: fixed;
          z-index: 2147483647;
          background: #1a1a2e;
          color: #eee;
          padding: 8px 14px;
          border-radius: 6px;
          font: 14px/1.4 system-ui, sans-serif;
          max-width: 320px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          pointer-events: none;
          animation: demon-commentary-in 0.3s ease-out forwards;
        }
        #${tooltipId}.demon-commentary-hiding {
          animation: demon-commentary-out 0.25s ease-in forwards;
        }
      `;

      // Remove previous style if any
      document.querySelector("style[data-demon-commentary]")?.remove();
      document.head.appendChild(style);

      // Position below the target element, horizontally centered
      const top = rect.bottom + 10;
      const left = rect.left + rect.width / 2;
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.transform = `translateX(-50%)`;

      document.body.appendChild(tooltip);
    },
    { selector: options.selector, text: options.text, tooltipId: TOOLTIP_ID },
  );
}

export async function hideCommentary(page: Page): Promise<void> {
  await page.evaluate((tooltipId) => {
    const tooltip = document.getElementById(tooltipId);
    if (!tooltip) return;

    tooltip.classList.add("demon-commentary-hiding");

    tooltip.addEventListener(
      "animationend",
      () => {
        tooltip.remove();
        document.querySelector("style[data-demon-commentary]")?.remove();
      },
      { once: true },
    );
  }, TOOLTIP_ID);

  // Wait for the animate-out to complete
  await page.waitForTimeout(300);
}
