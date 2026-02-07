import { describe, test, expect } from "bun:test";

import type { ExecFn, ReadFileFn } from "./git-context.ts";
import { getRepoContext } from "./git-context.ts";

function mockExec(responses: Record<string, string>): ExecFn {
  return async (cmd: string[], _cwd: string) => {
    const key = cmd.join(" ");
    if (key in responses) {
      return responses[key]!;
    }
    throw new Error(`Unexpected command: ${key}`);
  };
}

function mockReadFile(files: Record<string, string>): ReadFileFn {
  return (path: string) => {
    if (path in files) {
      return files[path]!;
    }
    throw new Error(`File not found: ${path}`);
  };
}

describe("getRepoContext", () => {
  test("returns diff from working tree when dirty and on main", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --abbrev-ref HEAD": "main\n",
      "git diff HEAD": "diff --git a/file.ts\n+added line\n",
      "git ls-files": "src/index.ts\n",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.gitDiff).toBe("diff --git a/file.ts\n+added line");
  });

  test("falls back to HEAD~1..HEAD when working tree is clean and on main", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --abbrev-ref HEAD": "main\n",
      "git diff HEAD": "",
      "git diff HEAD~1..HEAD": "diff --git a/committed.ts\n+committed line\n",
      "git ls-files": "",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.gitDiff).toBe("diff --git a/committed.ts\n+committed line");
  });

  test("auto-detects main as base when on feature branch", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --abbrev-ref HEAD": "feature-branch\n",
      "git rev-parse --verify main": "abc123\n",
      "git diff main...HEAD": "diff --git a/feature.ts\n+feature line\n",
      "git ls-files": "",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.gitDiff).toBe("diff --git a/feature.ts\n+feature line");
  });

  test("auto-detects master as base when main does not exist", async () => {
    const exec: ExecFn = async (cmd: string[], _cwd: string) => {
      const key = cmd.join(" ");
      const responses: Record<string, string> = {
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --abbrev-ref HEAD": "feature-branch\n",
        "git rev-parse --verify master": "abc123\n",
        "git diff master...HEAD": "diff --git a/feature.ts\n+feature line\n",
        "git ls-files": "",
      };
      if (key === "git rev-parse --verify main") {
        throw new Error("fatal: Needed a single revision");
      }
      if (key in responses) {
        return responses[key]!;
      }
      throw new Error(`Unexpected command: ${key}`);
    };
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.gitDiff).toBe("diff --git a/feature.ts\n+feature line");
  });

  test("uses explicit diffBase when provided", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git diff develop...HEAD": "diff --git a/feature.ts\n+feature line\n",
      "git ls-files": "",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile, diffBase: "develop" });
    expect(ctx.gitDiff).toBe("diff --git a/feature.ts\n+feature line");
  });

  test("uses explicit diffBase with commit hash", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git diff abc123...HEAD": "diff --git a/commit.ts\n+commit changes\n",
      "git ls-files": "",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile, diffBase: "abc123" });
    expect(ctx.gitDiff).toBe("diff --git a/commit.ts\n+commit changes");
  });

  test("discovers CLAUDE.md and SKILL.md files", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --abbrev-ref HEAD": "main\n",
      "git diff HEAD": "some diff\n",
      "git ls-files": "CLAUDE.md\nplugins/demo/SKILL.md\nsrc/index.ts\n",
    });
    const readFile = mockReadFile({
      "/repo/CLAUDE.md": "root guidelines",
      "/repo/plugins/demo/SKILL.md": "skill guidelines",
    });

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.guidelines).toHaveLength(2);
    expect(ctx.guidelines[0]).toBe("# CLAUDE.md\nroot guidelines");
    expect(ctx.guidelines[1]).toBe("# plugins/demo/SKILL.md\nskill guidelines");
  });

  test("returns empty guidelines when no CLAUDE.md or SKILL.md exist", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --abbrev-ref HEAD": "main\n",
      "git diff HEAD": "some diff\n",
      "git ls-files": "src/index.ts\npackage.json\n",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.guidelines).toEqual([]);
  });

  test("throws when git rev-parse fails", async () => {
    const exec: ExecFn = async () => {
      throw new Error("not a git repository");
    };
    const readFile = mockReadFile({});

    await expect(getRepoContext("/not-a-repo", { exec, readFile })).rejects.toThrow(
      "not a git repository",
    );
  });
});
