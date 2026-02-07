import { test as base } from "@playwright/test";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
  cpSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const PKG_DIR = resolve(import.meta.dirname, "..");
const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "review-metadata");
const DEMOON_FIXTURES_DIR = join(import.meta.dirname, "fixtures", "demoon-review");

type Fixtures = {
  workDir: string;
  tarball: string;
  installedPackageDir: string;
  mockAgentPath: string;
  demoDir: string;
  demoonReviewDir: string;
  demoonMockAgentPath: string;
  demoonIssueFilePath: string;
};

export const test = base.extend<Fixtures>({
  workDir: async ({}, use) => {
    const dir = join("/tmp", "demon", "tests", `e2e-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },

  tarball: async ({}, use) => {
    // Build the package
    const build = spawnSync("bash", ["build.sh"], { cwd: PKG_DIR });
    if (build.status !== 0) {
      throw new Error(`build.sh failed: ${build.stderr?.toString()}`);
    }

    // Pack the tarball
    const pack = spawnSync("npm", ["pack", "--pack-destination", "/tmp"], {
      cwd: PKG_DIR,
    });
    if (pack.status !== 0) {
      throw new Error(`npm pack failed: ${pack.stderr?.toString()}`);
    }

    const tarball = join("/tmp", pack.stdout.toString().trim());
    await use(tarball);
    rmSync(tarball, { force: true });
  },

  installedPackageDir: async ({ tarball }, use) => {
    const dir = join("/tmp", "demon", "tests", `installed-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "test-consumer", version: "0.0.0", private: true }),
    );

    const install = spawnSync("npm", ["install", tarball], {
      cwd: dir,
      timeout: 30_000,
    });
    if (install.status !== 0) {
      throw new Error(`npm install failed: ${install.stderr?.toString()}`);
    }

    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },

  demoDir: async ({ workDir }, use) => {
    const demoDir = join(workDir, "demos");
    mkdirSync(demoDir, { recursive: true });

    // Init git repo (required by the tool)
    spawnSync("git", ["init"], { cwd: demoDir });
    cpSync(join(FIXTURES_DIR, "before"), demoDir, { recursive: true });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: demoDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "initial"], { cwd: demoDir });

    // Replace with after/ state
    for (const entry of readdirSync(demoDir)) {
      if (entry !== ".git") {
        rmSync(join(demoDir, entry), { recursive: true, force: true });
      }
    }
    cpSync(join(FIXTURES_DIR, "after"), demoDir, { recursive: true });

    await use(demoDir);
  },

  mockAgentPath: async ({ workDir }, use) => {
    const scenarioPath = join(FIXTURES_DIR, "scenario.json");
    const agentPath = join(workDir, "agent.sh");
    writeFileSync(
      agentPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(agentPath, 0o755);
    await use(agentPath);
  },

  demoonReviewDir: async ({ workDir }, use) => {
    const repoDir = join(workDir, "demoon-repo");
    mkdirSync(repoDir, { recursive: true });

    // Init git repo
    spawnSync("git", ["init"], { cwd: repoDir });
    spawnSync("git", ["checkout", "-b", "feature-login"], { cwd: repoDir });
    cpSync(join(DEMOON_FIXTURES_DIR, "before"), repoDir, { recursive: true });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "add", "."], { cwd: repoDir });
    spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@test", "commit", "-m", "initial"], { cwd: repoDir });

    // Switch to after state (creates diff)
    for (const entry of readdirSync(repoDir)) {
      if (entry !== ".git") {
        rmSync(join(repoDir, entry), { recursive: true, force: true });
      }
    }
    cpSync(join(DEMOON_FIXTURES_DIR, "after"), repoDir, { recursive: true });

    // Pre-create the assets folder with demo files (simulating what presenter would create)
    const assetsDir = join(repoDir, ".demoon", "reviews", "feature-login", "assets");
    mkdirSync(assetsDir, { recursive: true });
    cpSync(join(DEMOON_FIXTURES_DIR, "demos"), assetsDir, { recursive: true });

    await use(repoDir);
  },

  demoonMockAgentPath: async ({ workDir }, use) => {
    const scenarioPath = join(DEMOON_FIXTURES_DIR, "scenario.json");
    const agentPath = join(workDir, "demoon-agent.sh");
    writeFileSync(
      agentPath,
      `#!/usr/bin/env bash\nexec mock-code run --scenario ${scenarioPath} "$@"\n`,
    );
    chmodSync(agentPath, 0o755);
    await use(agentPath);
  },

  demoonIssueFilePath: async ({}, use) => {
    await use(join(DEMOON_FIXTURES_DIR, "issue.json"));
  },
});

export { expect } from "@playwright/test";
export { FIXTURES_DIR, DEMOON_FIXTURES_DIR, PKG_DIR };
