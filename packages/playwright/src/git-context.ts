import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { getLogger } from "./logger.ts";

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
  const logger = getLogger();
  logger.debug("Detecting default base branch", { gitRoot });

  // Get current branch name
  let currentBranch: string;
  try {
    currentBranch = (await exec(["git", "rev-parse", "--abbrev-ref", "HEAD"], gitRoot)).trim();
    logger.debug("Current branch detected", { currentBranch });
  } catch (err) {
    logger.debug("Failed to detect current branch (detached HEAD or other issue)", { error: err instanceof Error ? err.message : String(err) });
    return null; // Detached HEAD or other issue
  }

  // If on main/master, no base to compare against
  if (currentBranch === "main" || currentBranch === "master") {
    logger.debug("On main/master branch, no base to compare against");
    return null;
  }

  // Try to find main or master as base
  for (const candidate of ["main", "master"]) {
    try {
      await exec(["git", "rev-parse", "--verify", candidate], gitRoot);
      logger.debug("Found base branch", { baseBranch: candidate });
      return candidate;
    } catch {
      logger.debug("Base branch candidate not found", { candidate });
      // Branch doesn't exist, try next
    }
  }

  logger.debug("No default base branch found");
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
  const logger = getLogger();
  const exec = options?.exec ?? defaultExec;
  const readFile = options?.readFile ?? defaultReadFile;

  logger.debug("Getting repo context", { demosDir, diffBase: options?.diffBase });

  const gitRoot = (await exec(["git", "rev-parse", "--show-toplevel"], demosDir)).trim();
  logger.debug("Git root found", { gitRoot });

  // Determine the base for diff comparison
  const diffBase = options?.diffBase ?? await detectDefaultBase(exec, gitRoot);
  logger.debug("Diff base determined", { diffBase, wasExplicit: !!options?.diffBase });

  let gitDiff: string;
  if (diffBase) {
    // Use three-dot diff for merge-base comparison (shows changes on current branch)
    logger.debug("Executing three-dot diff", { command: `git diff ${diffBase}...HEAD` });
    gitDiff = (await exec(["git", "diff", `${diffBase}...HEAD`], gitRoot)).trim();
    logger.debug("Git diff completed", { diffLength: gitDiff.length, diffBase });
  } else {
    // Fallback: worktree diff or last commit
    logger.debug("No diff base, trying worktree diff");
    const workingDiff = (await exec(["git", "diff", "HEAD"], gitRoot)).trim();
    if (workingDiff.length > 0) {
      gitDiff = workingDiff;
      logger.debug("Using worktree diff", { diffLength: gitDiff.length });
    } else {
      logger.debug("No worktree changes, using last commit diff");
      gitDiff = (await exec(["git", "diff", "HEAD~1..HEAD"], gitRoot)).trim();
      logger.debug("Using last commit diff", { diffLength: gitDiff.length });
    }
  }

  logger.debug("Listing git files for guidelines");
  const lsOutput = (await exec(["git", "ls-files"], gitRoot)).trim();
  const files = lsOutput.split("\n").filter((f) => f.length > 0);
  logger.debug("Git files listed", { totalFiles: files.length });

  const guidelinePatterns = ["CLAUDE.md", "SKILL.md"];
  const guidelines: string[] = [];

  for (const file of files) {
    const basename = file.split("/").pop() ?? "";
    if (guidelinePatterns.includes(basename)) {
      const fullPath = `${gitRoot}/${file}`;
      logger.debug("Reading guideline file", { file, fullPath });
      const content = readFile(fullPath);
      guidelines.push(`# ${file}\n${content}`);
      logger.debug("Guideline file read", { file, contentLength: content.length });
    }
  }

  logger.debug("Repo context complete", { gitDiffLength: gitDiff.length, guidelinesCount: guidelines.length });
  return { gitDiff, guidelines };
}
