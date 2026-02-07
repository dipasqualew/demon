import { test, expect, FIXTURES_DIR } from "./fixtures";
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync, execSync } from "node:child_process";

test.describe("demon-demo-review e2e", () => {
  test("generates review-metadata.json matching expected output", async ({ workDir, installedPackageDir }) => {
    // 1. Copy before/ into work dir, init git, commit
    cpSync(join(FIXTURES_DIR, "before"), workDir, { recursive: true });
    spawnSync("git", ["init"], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "initial"], { cwd: workDir });

    // 2. Remove non-.git entries, copy after/ into work dir
    for (const entry of readdirSync(workDir)) {
      if (entry !== ".git") {
        rmSync(join(workDir, entry), { recursive: true, force: true });
      }
    }
    cpSync(join(FIXTURES_DIR, "after"), workDir, { recursive: true });

    // 3. Write a bash wrapper script that calls mock-code
    const scenarioPath = join(FIXTURES_DIR, "scenario.json");
    const wrapperPath = join(workDir, "agent.sh");
    writeFileSync(
      wrapperPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(wrapperPath, 0o755);

    // 4. Run the CLI binary from installed package
    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-review");
    const result = spawnSync(bin, ["--agent", wrapperPath, workDir], {
      timeout: 30_000,
    });

    // 5. Assert exit code 0
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      throw new Error(`CLI exited with code ${result.status}: ${stderr}`);
    }

    // 6. Assert review-metadata.json matches expected
    const actual = readFileSync(join(workDir, "review-metadata.json"), "utf-8");
    const expected = readFileSync(join(FIXTURES_DIR, "expected-metadata.json"), "utf-8");
    expect(JSON.parse(actual)).toEqual(JSON.parse(expected));
  });

  test("supports --base for explicit base comparison", async ({ workDir, installedPackageDir }) => {
    // 1. Init git repo and create first commit
    spawnSync("git", ["init"], { cwd: workDir });
    mkdirSync(join(workDir, "demos"), { recursive: true });
    writeFileSync(join(workDir, "file1.ts"), "export const v1 = 1;");
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "first commit"], { cwd: workDir });

    // Capture the first commit SHA
    const firstCommit = execSync("git rev-parse HEAD", { cwd: workDir, encoding: "utf-8" }).trim();

    // 2. Create second commit with changes
    writeFileSync(join(workDir, "file1.ts"), "export const v1 = 2; // updated");
    writeFileSync(join(workDir, "file2.ts"), "export const v2 = 'new file';");
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "second commit"], { cwd: workDir });

    // 3. Copy demo files (after/ state)
    cpSync(join(FIXTURES_DIR, "after"), join(workDir, "demos"), { recursive: true });

    // 4. Write mock agent
    const scenarioPath = join(FIXTURES_DIR, "scenario.json");
    const wrapperPath = join(workDir, "agent.sh");
    writeFileSync(
      wrapperPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(wrapperPath, 0o755);

    // 5. Run CLI with --base pointing to first commit
    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-review");
    const result = spawnSync(bin, ["--agent", wrapperPath, "--base", firstCommit, join(workDir, "demos")], {
      timeout: 30_000,
    });

    // 6. Assert exit code 0
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      const stdout = result.stdout?.toString() ?? "";
      throw new Error(`CLI exited with code ${result.status}: ${stderr}\nstdout: ${stdout}`);
    }

    // 7. Assert review-metadata.json was generated
    const metadataPath = join(workDir, "demos", "review-metadata.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    expect(metadata).toHaveProperty("demos");
    expect(metadata).toHaveProperty("review");
  });

  test("auto-detects main as base when on feature branch", async ({ workDir, installedPackageDir }) => {
    // 1. Init git repo and create initial commit on main
    spawnSync("git", ["init", "-b", "main"], { cwd: workDir });
    mkdirSync(join(workDir, "demos"), { recursive: true });
    writeFileSync(join(workDir, "base.ts"), "export const base = 'main branch';");
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "main commit"], { cwd: workDir });

    // 2. Create feature branch and add changes
    spawnSync("git", ["checkout", "-b", "feature"], { cwd: workDir });
    writeFileSync(join(workDir, "feature.ts"), "export const feature = 'feature branch';");
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "feature commit"], { cwd: workDir });

    // 3. Copy demo files (after/ state)
    cpSync(join(FIXTURES_DIR, "after"), join(workDir, "demos"), { recursive: true });

    // 4. Write mock agent
    const scenarioPath = join(FIXTURES_DIR, "scenario.json");
    const wrapperPath = join(workDir, "agent.sh");
    writeFileSync(
      wrapperPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(wrapperPath, 0o755);

    // 5. Run CLI without --base (should auto-detect main as base)
    const bin = join(installedPackageDir, "node_modules", ".bin", "demon-demo-review");
    const result = spawnSync(bin, ["--agent", wrapperPath, join(workDir, "demos")], {
      timeout: 30_000,
    });

    // 6. Assert exit code 0
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      const stdout = result.stdout?.toString() ?? "";
      throw new Error(`CLI exited with code ${result.status}: ${stderr}\nstdout: ${stdout}`);
    }

    // 7. Assert review-metadata.json was generated
    const metadataPath = join(workDir, "demos", "review-metadata.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    expect(metadata).toHaveProperty("demos");
    expect(metadata).toHaveProperty("review");
  });
});
