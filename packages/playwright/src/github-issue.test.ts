import { describe, test, expect } from "bun:test";

import type { GraphQLFn } from "./github-issue.ts";
import { fetchGitHubIssue } from "./github-issue.ts";

function mockGraphQL(response: unknown): GraphQLFn {
  return (async () => response) as unknown as GraphQLFn;
}

describe("fetchGitHubIssue", () => {
  test("fetches issue successfully", async () => {
    const graphql = mockGraphQL({
      repository: {
        issue: {
          number: 42,
          title: "Fix the bug",
          body: "This bug needs fixing",
          state: "OPEN",
          labels: {
            nodes: [{ name: "bug" }, { name: "priority" }],
          },
        },
      },
    });

    const issue = await fetchGitHubIssue(42, {
      graphql,
      owner: "test-owner",
      repo: "test-repo",
      token: "fake-token",
    });

    expect(issue.number).toBe(42);
    expect(issue.title).toBe("Fix the bug");
    expect(issue.body).toBe("This bug needs fixing");
    expect(issue.state).toBe("open");
    expect(issue.labels).toEqual(["bug", "priority"]);
  });

  test("parses string issue ID", async () => {
    const graphql = mockGraphQL({
      repository: {
        issue: {
          number: 123,
          title: "String ID test",
          body: "",
          state: "CLOSED",
          labels: { nodes: [] },
        },
      },
    });

    const issue = await fetchGitHubIssue("123", {
      graphql,
      owner: "test-owner",
      repo: "test-repo",
      token: "fake-token",
    });

    expect(issue.number).toBe(123);
    expect(issue.state).toBe("closed");
  });

  test("handles null body", async () => {
    const graphql = mockGraphQL({
      repository: {
        issue: {
          number: 1,
          title: "No body",
          body: null,
          state: "OPEN",
          labels: { nodes: [] },
        },
      },
    });

    const issue = await fetchGitHubIssue(1, {
      graphql,
      owner: "test-owner",
      repo: "test-repo",
      token: "fake-token",
    });

    expect(issue.body).toBe("");
  });

  test("handles empty labels", async () => {
    const graphql = mockGraphQL({
      repository: {
        issue: {
          number: 1,
          title: "No labels",
          body: "body",
          state: "OPEN",
          labels: { nodes: [] },
        },
      },
    });

    const issue = await fetchGitHubIssue(1, {
      graphql,
      owner: "test-owner",
      repo: "test-repo",
      token: "fake-token",
    });

    expect(issue.labels).toEqual([]);
  });

  test("throws on invalid issue ID", async () => {
    const graphql = mockGraphQL({});

    await expect(
      fetchGitHubIssue("not-a-number", {
        graphql,
        owner: "test-owner",
        repo: "test-repo",
        token: "fake-token",
      }),
    ).rejects.toThrow("Invalid issue ID: not-a-number");
  });

  test("throws when no token provided and none in environment", async () => {
    const originalToken = process.env["GITHUB_TOKEN"];
    const originalGhToken = process.env["GH_TOKEN"];
    delete process.env["GITHUB_TOKEN"];
    delete process.env["GH_TOKEN"];

    try {
      await expect(
        fetchGitHubIssue(1, {
          owner: "test-owner",
          repo: "test-repo",
        }),
      ).rejects.toThrow("No GitHub token found");
    } finally {
      if (originalToken) process.env["GITHUB_TOKEN"] = originalToken;
      if (originalGhToken) process.env["GH_TOKEN"] = originalGhToken;
    }
  });

  test("uses GITHUB_TOKEN from environment", async () => {
    const originalToken = process.env["GITHUB_TOKEN"];
    process.env["GITHUB_TOKEN"] = "env-token";

    const graphql = mockGraphQL({
      repository: {
        issue: {
          number: 1,
          title: "Env token test",
          body: "",
          state: "OPEN",
          labels: { nodes: [] },
        },
      },
    });

    try {
      const issue = await fetchGitHubIssue(1, {
        graphql,
        owner: "test-owner",
        repo: "test-repo",
      });
      expect(issue.number).toBe(1);
    } finally {
      if (originalToken) {
        process.env["GITHUB_TOKEN"] = originalToken;
      } else {
        delete process.env["GITHUB_TOKEN"];
      }
    }
  });

  test("throws when GraphQL request fails", async () => {
    const graphql = (async () => {
      throw new Error("GraphQL request failed: Not Found");
    }) as unknown as GraphQLFn;

    await expect(
      fetchGitHubIssue(999999, {
        graphql,
        owner: "test-owner",
        repo: "test-repo",
        token: "fake-token",
      }),
    ).rejects.toThrow("GraphQL request failed: Not Found");
  });
});
