import { graphql as defaultGraphql } from "@octokit/graphql";
import { spawnSync } from "node:child_process";

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  state: string;
}

interface GitHubIssueGraphQLResponse {
  repository: {
    issue: {
      number: number;
      title: string;
      body: string;
      state: string;
      labels: {
        nodes: Array<{ name: string }>;
      };
    };
  };
}

export type GraphQLFn = typeof defaultGraphql;

export interface FetchGitHubIssueOptions {
  graphql?: GraphQLFn;
  owner?: string;
  repo?: string;
  token?: string;
}

const ISSUE_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        number
        title
        body
        state
        labels(first: 20) {
          nodes {
            name
          }
        }
      }
    }
  }
`;

function getRepoInfoFromGit(): { owner: string; repo: string } | null {
  try {
    const proc = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" });
    if (proc.status !== 0 || !proc.stdout) {
      return null;
    }

    const url = proc.stdout.trim();
    // Handle SSH format: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1]!, repo: sshMatch[2]! };
    }

    // Handle HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = url.match(/https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };
    }

    return null;
  } catch {
    return null;
  }
}

function getTokenFromEnvironment(): string | null {
  return process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"] ?? null;
}

export async function fetchGitHubIssue(
  issueId: string | number,
  options?: FetchGitHubIssueOptions,
): Promise<GitHubIssue> {
  const issueNumber = typeof issueId === "string" ? parseInt(issueId, 10) : issueId;
  if (isNaN(issueNumber)) {
    throw new Error(`Invalid issue ID: ${issueId}`);
  }

  // Get owner/repo from options or detect from git
  let owner = options?.owner;
  let repo = options?.repo;

  if (!owner || !repo) {
    const detected = getRepoInfoFromGit();
    if (!detected) {
      throw new Error(
        "Could not detect repository owner/name from git remote. " +
        "Please provide owner and repo options, or run from a git repository with a GitHub origin."
      );
    }
    owner = owner ?? detected.owner;
    repo = repo ?? detected.repo;
  }

  // Get token from options or environment
  const token = options?.token ?? getTokenFromEnvironment();
  if (!token) {
    throw new Error(
      "No GitHub token found. Please set GITHUB_TOKEN or GH_TOKEN environment variable, " +
      "or provide token in options."
    );
  }

  // Use provided graphql function or create one with the token
  const graphqlFn = options?.graphql ?? defaultGraphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  const response = await graphqlFn<GitHubIssueGraphQLResponse>(ISSUE_QUERY, {
    owner,
    repo,
    number: issueNumber,
  });

  const issue = response.repository.issue;

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    labels: issue.labels.nodes.map((l: { name: string }) => l.name),
    state: issue.state.toLowerCase(),
  };
}
