import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "/tmp/demon-demos",
  use: {
    baseURL: "http://localhost:3000",
    video: "on",
    viewport: { width: 1280, height: 720 },
    launchOptions: { slowMo: 500 },
  },
  reporter: [["list"]],
  projects: [{ name: "demo", use: { browserName: "chromium" } }],
});
