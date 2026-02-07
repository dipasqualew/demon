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

  let gitDiff: string;
  const workingDiff = (await exec(["git", "diff", "HEAD"], gitRoot)).trim();
  if (workingDiff.length > 0) {
    gitDiff = workingDiff;
  } else {
    gitDiff = (await exec(["git", "diff", "HEAD~1..HEAD"], gitRoot)).trim();
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
