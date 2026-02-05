import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const PKG_DIR = resolve(import.meta.dir, "..");
const FIXTURES = join(import.meta.dir, "fixtures", "review-metadata");

describe("demon-demo-review package binary", () => {
  let tarball: string;
  let workDir: string;

  beforeAll(() => {
    // 1. Build the package
    const build = spawnSync("bash", ["build.sh"], { cwd: PKG_DIR });
    if (build.status !== 0) {
      throw new Error(`build.sh failed: ${build.stderr?.toString()}`);
    }

    // 2. Pack the tarball
    const pack = spawnSync("npm", ["pack", "--pack-destination", "/tmp"], {
      cwd: PKG_DIR,
    });
    if (pack.status !== 0) {
      throw new Error(`npm pack failed: ${pack.stderr?.toString()}`);
    }
    tarball = join("/tmp", pack.stdout.toString().trim());
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
    rmSync(tarball, { force: true });
  });

  test("installs and runs demon-demo-review from the packed tarball", () => {
    // 3. Create a temp project and install the tarball
    workDir = join("/tmp", "demon", "tests", `package-bin-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ name: "test-consumer", version: "0.0.0", private: true }),
    );

    const install = spawnSync("npm", ["install", tarball], {
      cwd: workDir,
      timeout: 30_000,
    });
    if (install.status !== 0) {
      throw new Error(`npm install failed: ${install.stderr?.toString()}`);
    }

    // 4. Set up a demo directory with fixtures
    const demoDir = join(workDir, "demos");
    mkdirSync(demoDir, { recursive: true });

    // Init git repo (required by the tool)
    spawnSync("git", ["init"], { cwd: demoDir });
    cpSync(join(FIXTURES, "before"), demoDir, { recursive: true });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: demoDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "initial"], { cwd: demoDir });

    // Replace with after/ state
    for (const entry of readdirSync(demoDir)) {
      if (entry !== ".git") {
        rmSync(join(demoDir, entry), { recursive: true, force: true });
      }
    }
    cpSync(join(FIXTURES, "after"), demoDir, { recursive: true });

    // 5. Write mock agent wrapper
    const scenarioPath = join(FIXTURES, "scenario.json");
    const agentPath = join(workDir, "agent.sh");
    writeFileSync(
      agentPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(agentPath, 0o755);

    // 6. Run the installed binary
    const bin = join(workDir, "node_modules", ".bin", "demon-demo-review");
    const result = spawnSync(bin, ["--agent", agentPath, demoDir], {
      timeout: 30_000,
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? "";
      const stdout = result.stdout?.toString() ?? "";
      throw new Error(`Binary exited with code ${result.status}:\nstderr: ${stderr}\nstdout: ${stdout}`);
    }

    // 7. Verify outputs
    const metadata = JSON.parse(readFileSync(join(demoDir, "review-metadata.json"), "utf-8"));
    const expected = JSON.parse(readFileSync(join(FIXTURES, "expected-metadata.json"), "utf-8"));
    expect(metadata).toEqual(expected);

    const html = readFileSync(join(demoDir, "review.html"), "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("login-flow.webm");
    expect(html).toContain("signup.webm");
  });
});
