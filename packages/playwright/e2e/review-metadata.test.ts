import { describe, test, expect, beforeEach, afterEach } from "bun:test";
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
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const FIXTURES = join(import.meta.dir, "fixtures", "review-metadata");
const BINARY = join(import.meta.dir, "..", "src", "bin", "demon-demo-review.ts");

describe("demon-demo-review e2e", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = join("/tmp", "demon", "tests", `review-metadata-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  test("generates review-metadata.json matching expected output", () => {
    // 1. Copy before/ into work dir, init git, commit
    cpSync(join(FIXTURES, "before"), workDir, { recursive: true });
    spawnSync("git", ["init"], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: workDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "initial"], { cwd: workDir });

    // 2. Remove non-.git entries, copy after/ into work dir
    for (const entry of readdirSync(workDir)) {
      if (entry !== ".git") {
        rmSync(join(workDir, entry), { recursive: true, force: true });
      }
    }
    cpSync(join(FIXTURES, "after"), workDir, { recursive: true });

    // 3. Write a bash wrapper script that calls mock-code
    const scenarioPath = join(FIXTURES, "scenario.json");
    const wrapperPath = join(workDir, "agent.sh");
    writeFileSync(
      wrapperPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(wrapperPath, 0o755);

    // 4. Run the CLI binary
    const result = spawnSync("bun", ["run", BINARY, "--agent", wrapperPath, workDir], {
      timeout: 30_000,
    });

    // 5. Assert exit code 0
    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      throw new Error(`CLI exited with code ${result.status}: ${stderr}`);
    }

    // 6. Assert review-metadata.json matches expected
    const actual = readFileSync(join(workDir, "review-metadata.json"), "utf-8");
    const expected = readFileSync(join(FIXTURES, "expected-metadata.json"), "utf-8");
    expect(JSON.parse(actual)).toEqual(JSON.parse(expected));
  });
});
