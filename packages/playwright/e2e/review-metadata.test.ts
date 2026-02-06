import { test, expect, FIXTURES_DIR } from "./fixtures";
import {
  cpSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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
});
