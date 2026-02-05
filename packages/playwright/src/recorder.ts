import type { Page } from "@playwright/test";

import type { ShowCommentaryOptions } from "./commentary.ts";
import { showCommentary as defaultShowCommentary } from "./commentary.ts";

export interface DemoStep {
  text: string;
  timestampSeconds: number;
}

type ShowCommentaryFn = (
  page: Page,
  options: ShowCommentaryOptions,
) => Promise<void>;

type TestStepFn = (
  title: string,
  body: () => Promise<void>,
) => Promise<void>;

export interface DemoRecorderOptions {
  showCommentary?: ShowCommentaryFn;
  testStep?: TestStepFn;
}

export class DemoRecorder {
  private steps: DemoStep[] = [];
  private startTime: number;
  private showCommentaryFn: ShowCommentaryFn;
  private testStepFn: TestStepFn | undefined;

  constructor(options?: DemoRecorderOptions) {
    this.startTime = Date.now();
    this.showCommentaryFn = options?.showCommentary ?? defaultShowCommentary;
    this.testStepFn = options?.testStep;
  }

  async step(
    page: Page,
    text: string,
    options: { selector: string },
  ): Promise<void> {
    const body = async () => {
      await this.showCommentaryFn(page, {
        selector: options.selector,
        text,
      });

      const timestampSeconds =
        Math.round((Date.now() - this.startTime) / 100) / 10;

      this.steps.push({ text, timestampSeconds });
    };

    if (this.testStepFn) {
      await this.testStepFn(text, body);
    } else {
      await body();
    }
  }

  getSteps(): DemoStep[] {
    return [...this.steps];
  }

  async save(outputDir: string): Promise<void> {
    const { join } = await import("node:path");
    const { mkdirSync, writeFileSync } = await import("node:fs");

    mkdirSync(outputDir, { recursive: true });
    const filePath = join(outputDir, "demo-steps.json");
    writeFileSync(filePath, JSON.stringify(this.steps, null, 2) + "\n");
  }
}
