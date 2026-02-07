#!/usr/bin/env bun
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { runReviewOrchestration } from "../orchestrator.ts";
import { startFeedbackServer, type FeedbackPayload } from "../feedback-server.ts";
import type { GitHubIssue } from "../github-issue.ts";

function printUsage(): void {
  console.error("Usage: demoon <command> [options]");
  console.error("");
  console.error("Commands:");
  console.error("  review    Generate a review from a GitHub issue");
  console.error("");
  console.error("Review options:");
  console.error("  --github-issue-id <id>  GitHub issue number (required unless --issue-file is provided)");
  console.error("  --issue-file <path>     Path to JSON file with issue data (for testing, skips GitHub API)");
  console.error("  --base <ref>            Base commit/branch for diff (auto-detects main/master if on feature branch)");
  console.error("  --agent <path>          Path to Claude agent binary");
  console.error("  --port <number>         Port for feedback server (default: random available port)");
  console.error("");
  console.error("Environment variables:");
  console.error("  GITHUB_TOKEN or GH_TOKEN  GitHub personal access token (required for API access)");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const command = args[0];

  if (command !== "review") {
    console.error(`Unknown command: ${command}`);
    console.error("");
    printUsage();
    process.exit(1);
  }

  // Parse review command options
  let issueId: string | undefined;
  let issueFile: string | undefined;
  let diffBase: string | undefined;
  let agent: string | undefined;
  let port = 0;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--github-issue-id" || arg === "--issue") {
      issueId = args[++i];
    } else if (arg === "--issue-file") {
      issueFile = args[++i];
    } else if (arg === "--base") {
      diffBase = args[++i];
    } else if (arg === "--agent") {
      agent = args[++i];
    } else if (arg === "--port") {
      port = parseInt(args[++i] ?? "0", 10);
    } else if (!arg?.startsWith("-")) {
      // Allow positional issue ID for convenience
      if (!issueId) {
        issueId = arg;
      }
    }
  }

  // Load issue from file if provided
  let issue: GitHubIssue | undefined;
  if (issueFile) {
    const content = readFileSync(issueFile, "utf-8");
    issue = JSON.parse(content) as GitHubIssue;
    issueId = String(issue.number);
  }

  if (!issueId && !issue) {
    console.error("Error: --github-issue-id or --issue-file is required");
    console.error("");
    printUsage();
    process.exit(1);
  }

  // Start feedback server
  const feedbackServer = startFeedbackServer(port);

  try {
    if (issue) {
      console.log(`Using issue from file: #${issue.number} - ${issue.title}`);
    } else {
      console.log(`Fetching GitHub issue #${issueId}...`);
    }

    const result = await runReviewOrchestration({
      issueId: issueId!,
      issue,
      diffBase,
      agent,
      feedbackEndpoint: feedbackServer.feedbackEndpoint,
    });

    console.log("");
    console.log(`Review generated for issue #${result.issue.number}: ${result.issue.title}`);
    console.log("");
    console.log(`Verdict: ${result.metadata.review?.verdict ?? "unknown"}`);
    if (result.metadata.review?.verdictReason) {
      console.log(`Reason: ${result.metadata.review.verdictReason}`);
    }
    console.log("");
    console.log(`Review folder: ${result.reviewFolder}`);
    console.log(`Review HTML: ${resolve(result.htmlPath)}`);
    console.log("");
    console.log(`Feedback server running at: http://localhost:${feedbackServer.port}`);
    console.log(`Open the review HTML and approve/request changes to complete.`);
    console.log("");

    // Wait for user feedback
    const feedback: FeedbackPayload = await feedbackServer.waitForFeedback();

    console.log("");
    console.log("=".repeat(60));
    console.log(`User verdict: ${feedback.verdict}`);
    if (feedback.feedback) {
      console.log("");
      console.log("Feedback:");
      console.log(feedback.feedback);
    }
    console.log("=".repeat(60));

    // Exit with appropriate code
    process.exit(feedback.verdict === "approve" ? 0 : 1);
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    feedbackServer.stop();
    process.exit(1);
  }
}

main();
