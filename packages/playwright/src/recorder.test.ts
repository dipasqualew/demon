import { describe, test, expect, mock, beforeEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { DemoStep } from "./recorder.ts";
import { DemoRecorder } from "./recorder.ts";

function createMockShowCommentary() {
  const calls: Array<{ selector: string; text: string }> = [];
  const fn = mock(async (_page: unknown, options: { selector: string; text: string }) => {
    calls.push({ selector: options.selector, text: options.text });
  });
  return { fn, calls };
}

function createMockPage(): unknown {
  return { _mock: true };
}

describe("DemoRecorder", () => {
  describe("step()", () => {
    test("records timestampSeconds relative to construction time", async () => {
      const { fn: mockShow } = createMockShowCommentary();
      const demo = new DemoRecorder({ showCommentary: mockShow as never });

      await demo.step(createMockPage() as never, "First step", { selector: "#a" });
      const steps = demo.getSteps();

      expect(steps).toHaveLength(1);
      expect(steps[0]!.text).toBe("First step");
      expect(steps[0]!.timestampSeconds).toBeGreaterThanOrEqual(0);
      expect(steps[0]!.timestampSeconds).toBeLessThan(2);
    });

    test("calls showCommentary with correct args", async () => {
      const { fn: mockShow, calls } = createMockShowCommentary();
      const page = createMockPage();
      const demo = new DemoRecorder({ showCommentary: mockShow as never });

      await demo.step(page as never, "Click button", { selector: "#btn" });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ selector: "#btn", text: "Click button" });
    });

    test("wraps in testStep when provided", async () => {
      const { fn: mockShow } = createMockShowCommentary();
      const testStepCalls: string[] = [];
      const mockTestStep = async (title: string, body: () => Promise<void>) => {
        testStepCalls.push(title);
        await body();
      };

      const demo = new DemoRecorder({
        showCommentary: mockShow as never,
        testStep: mockTestStep,
      });

      await demo.step(createMockPage() as never, "Navigate to page", { selector: "body" });

      expect(testStepCalls).toEqual(["Navigate to page"]);
      expect(demo.getSteps()).toHaveLength(1);
    });

    test("multiple steps accumulate in order", async () => {
      const { fn: mockShow } = createMockShowCommentary();
      const demo = new DemoRecorder({ showCommentary: mockShow as never });
      const page = createMockPage();

      await demo.step(page as never, "Step 1", { selector: "#a" });
      await demo.step(page as never, "Step 2", { selector: "#b" });
      await demo.step(page as never, "Step 3", { selector: "#c" });

      const steps = demo.getSteps();
      expect(steps).toHaveLength(3);
      expect(steps.map((s) => s.text)).toEqual(["Step 1", "Step 2", "Step 3"]);
      expect(steps[0]!.timestampSeconds).toBeLessThanOrEqual(steps[1]!.timestampSeconds);
      expect(steps[1]!.timestampSeconds).toBeLessThanOrEqual(steps[2]!.timestampSeconds);
    });

    test("step not recorded if showCommentary throws", async () => {
      const failingShow = async () => {
        throw new Error("Element not found");
      };
      const demo = new DemoRecorder({ showCommentary: failingShow as never });

      await expect(
        demo.step(createMockPage() as never, "Bad step", { selector: "#missing" }),
      ).rejects.toThrow("Element not found");

      expect(demo.getSteps()).toHaveLength(0);
    });
  });

  describe("getSteps()", () => {
    test("returns a copy (mutation safety)", async () => {
      const { fn: mockShow } = createMockShowCommentary();
      const demo = new DemoRecorder({ showCommentary: mockShow as never });

      await demo.step(createMockPage() as never, "Step 1", { selector: "#a" });

      const steps1 = demo.getSteps();
      const steps2 = demo.getSteps();
      expect(steps1).toEqual(steps2);
      expect(steps1).not.toBe(steps2);

      steps1.push({ text: "fake", timestampSeconds: 99 });
      expect(demo.getSteps()).toHaveLength(1);
    });
  });

  describe("save()", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = join("/tmp", "demon", "tests", `recorder-${randomUUID()}`);
      mkdirSync(tmpDir, { recursive: true });
    });

    test("creates output directory if it does not exist", async () => {
      const { fn: mockShow } = createMockShowCommentary();
      const demo = new DemoRecorder({ showCommentary: mockShow as never });
      const page = createMockPage();

      await demo.step(page as never, "Step 1", { selector: "#a" });

      const nestedDir = join(tmpDir, "nested", "deep");
      expect(existsSync(nestedDir)).toBe(false);

      await demo.save(nestedDir);

      expect(existsSync(nestedDir)).toBe(true);
      const content = JSON.parse(readFileSync(join(nestedDir, "demo-steps.json"), "utf-8"));
      expect(content).toHaveLength(1);
      expect(content[0].text).toBe("Step 1");
    });

    test("writes correct JSON to demo-steps.json", async () => {
      const { fn: mockShow } = createMockShowCommentary();
      const demo = new DemoRecorder({ showCommentary: mockShow as never });
      const page = createMockPage();

      await demo.step(page as never, "Navigate to page", { selector: "body" });
      await demo.step(page as never, "Click button", { selector: "#btn" });

      await demo.save(tmpDir);

      const filePath = join(tmpDir, "demo-steps.json");
      const content = JSON.parse(readFileSync(filePath, "utf-8")) as DemoStep[];

      expect(content).toHaveLength(2);
      expect(content[0]!.text).toBe("Navigate to page");
      expect(content[1]!.text).toBe("Click button");
      expect(typeof content[0]!.timestampSeconds).toBe("number");
      expect(typeof content[1]!.timestampSeconds).toBe("number");

      rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
