import { test, expect, FIXTURES_DIR, DEMOON_FIXTURES_DIR } from "./fixtures";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test.describe("demon-demo-review package binary", () => {
  test("installs and runs demon-demo-review from the packed tarball", async ({
    installedPackageDir,
    demoDir,
    mockAgentPath,
  }) => {
    // Run the installed binary
    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-review");
    const result = spawnSync(bin, ["--agent", mockAgentPath, demoDir], {
      timeout: 30_000,
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      const stdout = result.stdout?.toString() ?? "";
      throw new Error(`Binary exited with code ${result.status}:\nstderr: ${stderr}\nstdout: ${stdout}`);
    }

    // Verify outputs
    const metadata = JSON.parse(readFileSync(join(demoDir, "review-metadata.json"), "utf-8"));
    const expected = JSON.parse(readFileSync(join(FIXTURES_DIR, "expected-metadata.json"), "utf-8"));
    expect(metadata).toEqual(expected);

    const html = readFileSync(join(demoDir, "review.html"), "utf-8");
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toContain("login-flow.webm");
    expect(html).toContain("signup.webm");
  });
});

test.describe("demon-demo-init package binary", () => {
  test("creates example.demo.ts when config exists", async ({ installedPackageDir, workDir }) => {
    const testDir = join(workDir, "config-exists");
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "playwright.demo.config.ts"), "export default {}");

    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-init");
    const result = spawnSync(bin, [testDir], { timeout: 10_000 });

    expect(result.status).toBe(0);
    expect(result.stdout?.toString().trim()).toBe(join(testDir, "example.demo.ts"));

    const content = readFileSync(join(testDir, "example.demo.ts"), "utf-8");
    expect(content).toContain('import { test } from "@playwright/test"');
    expect(content).toContain('import { DemoRecorder } from "@demon-utils/playwright"');
    expect(content).toContain("demo.step(page,");
    expect(content).toContain("demo.save(testInfo.outputDir)");
  });

  test("exits with code 1 when no config found", async ({ installedPackageDir, workDir }) => {
    const testDir = join(workDir, "no-config");
    mkdirSync(testDir, { recursive: true });

    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-init");
    const result = spawnSync(bin, [testDir], { timeout: 10_000 });

    expect(result.status).toBe(1);
    expect(result.stderr?.toString()).toContain("Could not find playwright.demo.config.ts");
    expect(result.stderr?.toString()).toContain(testDir);
  });

  test("finds config in parent directory", async ({ installedPackageDir, workDir }) => {
    const testDir = join(workDir, "parent-config");
    const subDir = join(testDir, "apps", "web", "src");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(testDir, "playwright.demo.config.ts"), "export default {}");

    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-init");
    const result = spawnSync(bin, [subDir], { timeout: 10_000 });

    expect(result.status).toBe(0);
    expect(result.stdout?.toString().trim()).toBe(join(testDir, "example.demo.ts"));
    expect(readFileSync(join(testDir, "example.demo.ts"), "utf-8")).toContain("DemoRecorder");
  });

  test("overwrites existing example.demo.ts", async ({ installedPackageDir, workDir }) => {
    const testDir = join(workDir, "overwrite");
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "playwright.demo.config.ts"), "export default {}");
    writeFileSync(join(testDir, "example.demo.ts"), "// old content");

    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-init");
    const result = spawnSync(bin, [testDir], { timeout: 10_000 });

    expect(result.status).toBe(0);
    const content = readFileSync(join(testDir, "example.demo.ts"), "utf-8");
    expect(content).not.toContain("old content");
    expect(content).toContain("DemoRecorder");
  });
});

test.describe("demoon review package binary", () => {
  test("generates review files and embeds feedback endpoint", async ({
    installedPackageDir,
    demoonReviewDir,
    demoonMockAgentPath,
    demoonIssueFilePath,
  }) => {
    // For now, just verify the review generation works without waiting for feedback
    // The feedback server integration is tested separately in mcp-server tests
    const bin = join(installedPackageDir, "node_modules", ".bin", "demoon");
    const { spawn } = await import("node:child_process");

    const proc = spawn(bin, [
      "review",
      "--issue-file", demoonIssueFilePath,
      "--agent", demoonMockAgentPath,
      "--port", "0",
    ], {
      cwd: demoonReviewDir,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (data) => { stdout += data.toString(); });
    proc.stderr?.on("data", (data) => { stderr += data.toString(); });

    // Wait for the review to be generated and server URL to appear
    let feedbackUrl: string | null = null;
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const match = stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        feedbackUrl = match[0];
        break;
      }
    }

    if (!feedbackUrl) {
      proc.kill();
      throw new Error(`Server URL not found in output:\nstdout: ${stdout}\nstderr: ${stderr}`);
    }

    // Verify review files were created
    const assetsDir = join(demoonReviewDir, ".demoon", "reviews", "feature-login", "assets");
    expect(existsSync(join(assetsDir, "review.html"))).toBe(true);
    expect(existsSync(join(assetsDir, "review-metadata.json"))).toBe(true);

    // Verify metadata content
    const metadata = JSON.parse(readFileSync(join(assetsDir, "review-metadata.json"), "utf-8"));
    const expected = JSON.parse(readFileSync(join(DEMOON_FIXTURES_DIR, "expected-metadata.json"), "utf-8"));
    expect(metadata).toEqual(expected);

    // Verify HTML contains expected content and feedback endpoint
    const html = readFileSync(join(assetsDir, "review.html"), "utf-8");
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toContain("login-demo.webm");
    expect(html).toContain("api-demo.jsonl");
    expect(html).toContain("feedbackEndpoint");
    expect(html).toContain(feedbackUrl);

    // Kill the process since we're not testing the feedback flow here
    proc.kill();
  });
});
