import type { ReviewAppData } from "./types";

const mockLogContent = `{"timestamp":"2024-01-15T10:30:00.123Z","level":"info","message":"Starting database migration..."}
{"timestamp":"2024-01-15T10:30:00.456Z","level":"info","message":"Connected to PostgreSQL on localhost:5432"}
{"timestamp":"2024-01-15T10:30:01.001Z","level":"info","message":"Running migration: 001_create_users_table","demon__highlight":true}
{"timestamp":"2024-01-15T10:30:01.234Z","level":"debug","message":"CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL)"}
{"timestamp":"2024-01-15T10:30:01.567Z","level":"info","message":"Migration 001 completed successfully"}
{"timestamp":"2024-01-15T10:30:02.001Z","level":"info","message":"Running migration: 002_add_user_roles","demon__highlight":"This migration adds role-based access control to the users table"}
{"timestamp":"2024-01-15T10:30:02.234Z","level":"debug","message":"ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user'"}
{"timestamp":"2024-01-15T10:30:02.567Z","level":"info","message":"Migration 002 completed successfully"}
{"timestamp":"2024-01-15T10:30:03.001Z","level":"warn","message":"Skipping migration 003 - already applied"}
{"timestamp":"2024-01-15T10:30:03.234Z","level":"info","message":"All migrations completed","demon__highlight":"Database is now up to date with 2 new migrations applied"}
{"timestamp":"2024-01-15T10:30:03.456Z","level":"info","message":"Disconnected from database"}`;

export const mockData: ReviewAppData = {
  title: "Demo Review",
  videos: {},
  logs: {
    "db-migration.jsonl": mockLogContent,
  },
  metadata: {
    demos: [
      {
        file: "login-flow.webm",
        type: "web-ux",
        summary: "Shows the login flow end to end",
        steps: [
          { timestampSeconds: 0, text: "Page loads" },
          { timestampSeconds: 5, text: "User types credentials" },
          { timestampSeconds: 12, text: "Login succeeds" },
        ],
      },
      {
        file: "signup.webm",
        type: "web-ux",
        summary: "Demonstrates the signup process",
        steps: [
          { timestampSeconds: 0, text: "Signup form appears" },
          { timestampSeconds: 8, text: "Form submitted" },
        ],
      },
      {
        file: "db-migration.jsonl",
        type: "log-based",
        summary: "Database migration script execution with role-based access control setup",
        steps: [],
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
