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
  test("returns diff from working tree when dirty", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git diff HEAD": "diff --git a/file.ts\n+added line\n",
      "git ls-files": "src/index.ts\n",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.gitDiff).toBe("diff --git a/file.ts\n+added line");
  });

  test("falls back to HEAD~1..HEAD when working tree is clean", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
      "git diff HEAD": "",
      "git diff HEAD~1..HEAD": "diff --git a/committed.ts\n+committed line\n",
      "git ls-files": "",
    });
    const readFile = mockReadFile({});

    const ctx = await getRepoContext("/repo/demos", { exec, readFile });
    expect(ctx.gitDiff).toBe("diff --git a/committed.ts\n+committed line");
  });

  test("discovers CLAUDE.md and SKILL.md files", async () => {
    const exec = mockExec({
      "git rev-parse --show-toplevel": "/repo\n",
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
