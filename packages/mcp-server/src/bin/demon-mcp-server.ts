#!/usr/bin/env bun
import { runServer } from "../server.ts";
import { generateReview } from "@demon-utils/playwright";

const port = parseInt(process.env["MCP_PORT"] ?? "3000", 10);
const publicUrl = process.env["MCP_PUBLIC_URL"];

if (!publicUrl) {
  console.error("Error: MCP_PUBLIC_URL environment variable is required.");
  console.error("Example: MCP_PUBLIC_URL=http://localhost:3000 demon-mcp-server");
  process.exit(1);
}

const config = { port, publicUrl };

console.log(`Starting MCP server...`);
console.log(`  Port: ${port}`);
console.log(`  Public URL: ${publicUrl}`);

await runServer({ config, generateReview });
