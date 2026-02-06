import type { ReviewAppData } from "./types";

export const mockData: ReviewAppData = {
  title: "Demo Review",
  videos: {},
  metadata: {
    demos: [
      {
        file: "login-flow.webm",
        summary: "Shows the login flow end to end",
        steps: [
          { timestampSeconds: 0, text: "Page loads" },
          { timestampSeconds: 5, text: "User types credentials" },
          { timestampSeconds: 12, text: "Login succeeds" },
        ],
      },
      {
        file: "signup.webm",
        summary: "Demonstrates the signup process",
        steps: [
          { timestampSeconds: 0, text: "Signup form appears" },
          { timestampSeconds: 8, text: "Form submitted" },
        ],
      },
    ],
    review: {
      summary: "Good changes overall with clean implementation",
      highlights: [
        "Clean implementation with good separation of concerns",
        "Comprehensive test coverage for edge cases",
        "Well-documented API endpoints",
      ],
      verdict: "request_changes",
      verdictReason:
        "Minor improvements needed before merging, but overall solid work",
      issues: [
        {
          severity: "major",
          description: "Memory leak in event handler - missing cleanup on unmount",
        },
        {
          severity: "minor",
          description: "Missing edge case test for empty input validation",
        },
        {
          severity: "nit",
          description: "Consider renaming variable 'x' to something more descriptive",
        },
      ],
    },
  },
};
