import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export type ExecFn = (cmd: string[], cwd: string) => Promise<string>;
export type ReadFileFn = (path: string) => string;

export interface RepoContext {
  gitDiff: string;
  guidelines: string[];
}

export interface GetRepoContextOptions {
  exec?: ExecFn;
  readFile?: ReadFileFn;
  diffBase?: string;  // Base commit/branch for diff (auto-detected if not provided)
}

async function detectDefaultBase(exec: ExecFn, gitRoot: string): Promise<string | null> {
  // Get current branch name
  let currentBranch: string;
  try {
    currentBranch = (await exec(["git", "rev-parse", "--abbrev-ref", "HEAD"], gitRoot)).trim();
  } catch {
    return null; // Detached HEAD or other issue
  }

  // If on main/master, no base to compare against
  if (currentBranch === "main" || currentBranch === "master") {
    return null;
  }

  // Try to find main or master as base
  for (const candidate of ["main", "master"]) {
    try {
      await exec(["git", "rev-parse", "--verify", candidate], gitRoot);
      return candidate;
    } catch {
      // Branch doesn't exist, try next
    }
  }

  return null;
}

const defaultExec: ExecFn = async (cmd, cwd) => {
  const [command, ...args] = cmd;
  const proc = spawnSync(command!, args, { cwd, encoding: "utf-8" });
  if (proc.status !== 0) {
    const stderr = (proc.stderr ?? "").trim();
    throw new Error(`Command failed (exit ${proc.status}): ${cmd.join(" ")}${stderr ? `: ${stderr}` : ""}`);
  }
  return proc.stdout ?? "";
};

const defaultReadFile: ReadFileFn = (path) => {
  return readFileSync(path, "utf-8");
};

export async function getRepoContext(
  demosDir: string,
  options?: GetRepoContextOptions,
): Promise<RepoContext> {
  const exec = options?.exec ?? defaultExec;
  const readFile = options?.readFile ?? defaultReadFile;

  const gitRoot = (await exec(["git", "rev-parse", "--show-toplevel"], demosDir)).trim();

  // Determine the base for diff comparison
  const diffBase = options?.diffBase ?? await detectDefaultBase(exec, gitRoot);

  let gitDiff: string;
  if (diffBase) {
    // Use three-dot diff for merge-base comparison (shows changes on current branch)
    gitDiff = (await exec(["git", "diff", `${diffBase}...HEAD`], gitRoot)).trim();
  } else {
    // Fallback: worktree diff or last commit
    const workingDiff = (await exec(["git", "diff", "HEAD"], gitRoot)).trim();
    if (workingDiff.length > 0) {
      gitDiff = workingDiff;
    } else {
      gitDiff = (await exec(["git", "diff", "HEAD~1..HEAD"], gitRoot)).trim();
    }
  }

  const lsOutput = (await exec(["git", "ls-files"], gitRoot)).trim();
  const files = lsOutput.split("\n").filter((f) => f.length > 0);

  const guidelinePatterns = ["CLAUDE.md", "SKILL.md"];
  const guidelines: string[] = [];

  for (const file of files) {
    const basename = file.split("/").pop() ?? "";
    if (guidelinePatterns.includes(basename)) {
      const fullPath = `${gitRoot}/${file}`;
      const content = readFile(fullPath);
      guidelines.push(`# ${file}\n${content}`);
    }
  }

  return { gitDiff, guidelines };
}
