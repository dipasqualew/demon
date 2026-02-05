import { describe, test, expect } from "bun:test";

import type { ReviewMetadata, CodeReview } from "./review-types.ts";
import { generateReviewHtml } from "./html-generator.ts";

function makeReview(overrides?: Partial<CodeReview>): CodeReview {
  return {
    summary: "Good changes overall",
    highlights: ["Clean implementation", "Good test coverage"],
    verdict: "approve",
    verdictReason: "No major issues found",
    issues: [],
    ...overrides,
  };
}

function makeMetadata(overrides?: Partial<ReviewMetadata>): ReviewMetadata {
  return {
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
    review: makeReview(),
    ...overrides,
  };
}

describe("generateReviewHtml", () => {
  describe("structure", () => {
    test("starts with <!DOCTYPE html>", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toStartWith("<!DOCTYPE html>");
    });

    test("contains required elements", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("<style>");
      expect(html).toContain("</style>");
      expect(html).toContain("<script>");
      expect(html).toContain("</script>");
      expect(html).toContain("<video");
      expect(html).toContain("<header>");
      expect(html).toContain('class="review-layout"');
    });
  });

  describe("video element", () => {
    test("has correct id and initial src", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('id="review-video"');
      expect(html).toContain('src="login-flow.webm"');
    });

    test("has custom controls bar instead of native controls", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).not.toMatch(/<video[^>]*\bcontrols\b/);
      expect(html).toContain('class="video-controls"');
      expect(html).toContain('id="vc-play"');
      expect(html).toContain('id="vc-seek"');
      expect(html).toContain('id="vc-time"');
    });
  });

  describe("title", () => {
    test("defaults to Demo Review", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("<title>Demo Review</title>");
      expect(html).toContain("<h1>Demo Review</h1>");
    });

    test("uses custom title when provided", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata(),
        title: "My Custom Review",
      });
      expect(html).toContain("<title>My Custom Review</title>");
      expect(html).toContain("<h1>My Custom Review</h1>");
    });
  });

  describe("demo navigation", () => {
    test("renders one button per demo", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('data-index="0"');
      expect(html).toContain('data-index="1"');
      expect(html).not.toContain('data-index="2"');
    });

    test("first button has active class", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('data-index="0" class="active"');
    });

    test("second button does not have active class", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      const idx1Match = html.match(/data-index="1"([^>]*)/);
      expect(idx1Match).toBeTruthy();
      expect(idx1Match![1]).not.toContain("active");
    });

    test("displays demo filenames", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("login-flow.webm");
      expect(html).toContain("signup.webm");
    });
  });

  describe("metadata embedding", () => {
    test("embeds metadata JSON in script", () => {
      const metadata = makeMetadata();
      const html = generateReviewHtml({ metadata });
      expect(html).toContain("login-flow.webm");
      expect(html).toContain("Shows the login flow end to end");
      expect(html).toContain("var metadata =");
    });

    test("escapes </ in JSON to prevent script breakout", () => {
      const metadata = makeMetadata({
        demos: [
          {
            file: "test.webm",
            summary: "contains </script> tag",
            steps: [],
          },
        ],
      });
      const html = generateReviewHtml({ metadata });
      expect(html).not.toContain("</script> tag");
      expect(html).toContain("<\\/script> tag");
    });
  });

  describe("HTML escaping", () => {
    test("escapes special chars in filenames", () => {
      const metadata = makeMetadata({
        demos: [
          {
            file: '<img src="x">.webm',
            summary: "normal summary",
            steps: [],
          },
        ],
      });
      const html = generateReviewHtml({ metadata });
      expect(html).not.toContain('<img src="x">');
      expect(html).toContain("&lt;img src=&quot;x&quot;&gt;.webm");
    });

    test("escapes special chars in title", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata(),
        title: 'Test & <Review> "Page"',
      });
      expect(html).toContain("Test &amp; &lt;Review&gt; &quot;Page&quot;");
    });
  });

  describe("edge cases", () => {
    test("throws on empty demos array", () => {
      expect(() =>
        generateReviewHtml({ metadata: { demos: [] } }),
      ).toThrow("metadata.demos must not be empty");
    });

    test("handles demo with many steps", () => {
      const steps = Array.from({ length: 100 }, (_, i) => ({
        timestampSeconds: i * 10,
        text: `Step ${i}`,
      }));
      const metadata: ReviewMetadata = {
        demos: [
          { file: "long.webm", summary: "Long demo", steps },
        ],
      };
      const html = generateReviewHtml({ metadata });
      expect(html).toContain("Step 0");
      expect(html).toContain("Step 99");
    });

    test("handles single demo", () => {
      const metadata: ReviewMetadata = {
        demos: [
          {
            file: "only.webm",
            summary: "The only demo",
            steps: [{ timestampSeconds: 3, text: "Something happens" }],
          },
        ],
      };
      const html = generateReviewHtml({ metadata });
      expect(html).toContain('data-index="0"');
      expect(html).not.toContain('data-index="1"');
      expect(html).toContain('src="only.webm"');
    });
  });

  describe("steps section", () => {
    test("renders Steps section", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('id="steps-section"');
      expect(html).toContain('id="steps-list"');
    });

    test("includes step-active CSS class", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("step-active");
    });

    test("includes timeupdate event handler", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("timeupdate");
      expect(html).toContain("#steps-list button[data-time]");
    });

    test("embeds step data in metadata JSON", () => {
      const metadata: ReviewMetadata = {
        demos: [
          {
            file: "demo.webm",
            summary: "Demo with steps",
            steps: [
              { timestampSeconds: 1.5, text: "Step one" },
            ],
          },
        ],
      };
      const html = generateReviewHtml({ metadata });
      expect(html).toContain("Step one");
      expect(html).toContain("1.5");
    });

    test("does not contain annotations section", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).not.toContain("annotations-section");
      expect(html).not.toContain("annotations-list");
    });
  });

  describe("tabs", () => {
    test("renders tab bar with Summary and Demos tabs when review present", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('class="tab-bar"');
      expect(html).toContain('data-tab="summary"');
      expect(html).toContain('data-tab="demos"');
      expect(html).toContain(">Summary</button>");
      expect(html).toContain(">Demos</button>");
    });

    test("renders only Demos tab when review is absent", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: undefined }),
      });
      expect(html).toContain('class="tab-bar"');
      expect(html).not.toContain('data-tab="summary"');
      expect(html).toContain('data-tab="demos"');
    });

    test("Summary tab is active by default when review present", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      const summaryBtn = html.match(/class="tab-btn([^"]*)"[^>]*data-tab="summary"/);
      expect(summaryBtn).toBeTruthy();
      expect(summaryBtn![1]).toContain("active");

      const demosBtn = html.match(/class="tab-btn([^"]*)"[^>]*data-tab="demos"/);
      expect(demosBtn).toBeTruthy();
      expect(demosBtn![1]).not.toContain("active");
    });

    test("Demos tab is active by default when review is absent", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: undefined }),
      });
      const demosBtn = html.match(/class="tab-btn([^"]*)"[^>]*data-tab="demos"/);
      expect(demosBtn).toBeTruthy();
      expect(demosBtn![1]).toContain("active");
    });

    test("tab-summary panel is active when review present", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('id="tab-summary"');
      const panel = html.match(/id="tab-summary"[^>]*class="tab-panel([^"]*)"/);
      expect(panel).toBeTruthy();
      expect(panel![1]).toContain("active");
    });

    test("tab-demos panel is not active when review present", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      const panel = html.match(/id="tab-demos"[^>]*class="tab-panel([^"]*)"/);
      expect(panel).toBeTruthy();
      expect(panel![1]).not.toContain("active");
    });

    test("tab-demos panel is active when review absent", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: undefined }),
      });
      const panel = html.match(/id="tab-demos"[^>]*class="tab-panel([^"]*)"/);
      expect(panel).toBeTruthy();
      expect(panel![1]).toContain("active");
    });

    test("no tab-summary panel when review absent", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: undefined }),
      });
      expect(html).not.toContain('id="tab-summary"');
    });

    test("includes tab switching JS", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("tabBtns");
      expect(html).toContain("tabPanels");
      expect(html).toContain('data-tab');
    });
  });

  describe("review section", () => {
    test("renders review section when review is present", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain('class="review-section"');
      expect(html).toContain('class="review-body"');
    });

    test("does not render review section when review is absent", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: undefined }),
      });
      expect(html).not.toContain('class="review-section"');
      expect(html).not.toContain('class="verdict-banner');
    });

    test("verdict banner has approve class for approve verdict", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: makeReview({ verdict: "approve" }) }),
      });
      expect(html).toContain('class="verdict-banner approve"');
      expect(html).toContain("Approved");
    });

    test("verdict banner has request-changes class for request_changes verdict", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: makeReview({ verdict: "request_changes" }) }),
      });
      expect(html).toContain('class="verdict-banner request-changes"');
      expect(html).toContain("Changes Requested");
    });

    test("renders review summary", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: makeReview({ summary: "Overall solid work" }) }),
      });
      expect(html).toContain("Overall solid work");
    });

    test("renders highlights list", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({
          review: makeReview({ highlights: ["Fast response", "Good error handling"] }),
        }),
      });
      expect(html).toContain('class="highlights-list"');
      expect(html).toContain("Fast response");
      expect(html).toContain("Good error handling");
    });

    test("renders issues with severity badges", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({
          review: makeReview({
            issues: [
              { severity: "major", description: "Memory leak in handler" },
              { severity: "minor", description: "Missing edge case" },
              { severity: "nit", description: "Rename variable" },
            ],
          }),
        }),
      });
      expect(html).toContain('class="issue major"');
      expect(html).toContain('class="issue minor"');
      expect(html).toContain('class="issue nit"');
      expect(html).toContain('class="severity-badge">MAJOR');
      expect(html).toContain('class="severity-badge">MINOR');
      expect(html).toContain('class="severity-badge">NIT');
      expect(html).toContain("Memory leak in handler");
      expect(html).toContain("Missing edge case");
      expect(html).toContain("Rename variable");
    });

    test("shows no-issues message when issues array is empty", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({ review: makeReview({ issues: [] }) }),
      });
      expect(html).toContain('class="no-issues"');
      expect(html).toContain("No issues found");
    });

    test("escapes HTML in review text", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({
          review: makeReview({
            summary: '<script>alert("xss")</script>',
            verdictReason: "Uses <b>dangerous</b> patterns",
            highlights: ['Handles <img src="x"> gracefully'],
            issues: [
              { severity: "major", description: 'Found <script>alert("xss")</script>' },
            ],
          }),
        }),
      });
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain("&lt;script&gt;alert");
      expect(html).toContain("&lt;b&gt;dangerous&lt;/b&gt;");
    });

    test("review section is inside summary tab panel", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      const summaryPanelIdx = html.indexOf('id="tab-summary"');
      const reviewSectionIdx = html.indexOf('class="review-section"');
      const demosPanelIdx = html.indexOf('id="tab-demos"');
      expect(summaryPanelIdx).toBeGreaterThan(-1);
      expect(reviewSectionIdx).toBeGreaterThan(summaryPanelIdx);
      expect(reviewSectionIdx).toBeLessThan(demosPanelIdx);
    });

    test("renders verdict reason", () => {
      const html = generateReviewHtml({
        metadata: makeMetadata({
          review: makeReview({ verdictReason: "All tests pass and code is clean" }),
        }),
      });
      expect(html).toContain("All tests pass and code is clean");
    });
  });
});
