import { describe, test, expect } from "bun:test";

import type { ReviewMetadata } from "./review-types.ts";
import { generateReviewHtml } from "./html-generator.ts";

function makeMetadata(overrides?: Partial<ReviewMetadata>): ReviewMetadata {
  return {
    demos: [
      {
        file: "login-flow.webm",
        summary: "Shows the login flow end to end",
        annotations: [
          { timestampSeconds: 0, text: "Page loads" },
          { timestampSeconds: 5, text: "User types credentials" },
          { timestampSeconds: 12, text: "Login succeeds" },
        ],
      },
      {
        file: "signup.webm",
        summary: "Demonstrates the signup process",
        annotations: [
          { timestampSeconds: 0, text: "Signup form appears" },
          { timestampSeconds: 8, text: "Form submitted" },
        ],
      },
    ],
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

    test("has controls attribute", () => {
      const html = generateReviewHtml({ metadata: makeMetadata() });
      expect(html).toContain("<video id=\"review-video\" controls");
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
            annotations: [],
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
            annotations: [],
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

    test("handles demo with many annotations", () => {
      const annotations = Array.from({ length: 100 }, (_, i) => ({
        timestampSeconds: i * 10,
        text: `Annotation ${i}`,
      }));
      const metadata: ReviewMetadata = {
        demos: [
          { file: "long.webm", summary: "Long demo", annotations },
        ],
      };
      const html = generateReviewHtml({ metadata });
      expect(html).toContain("Annotation 0");
      expect(html).toContain("Annotation 99");
    });

    test("handles single demo", () => {
      const metadata: ReviewMetadata = {
        demos: [
          {
            file: "only.webm",
            summary: "The only demo",
            annotations: [{ timestampSeconds: 3, text: "Something happens" }],
          },
        ],
      };
      const html = generateReviewHtml({ metadata });
      expect(html).toContain('data-index="0"');
      expect(html).not.toContain('data-index="1"');
      expect(html).toContain('src="only.webm"');
    });
  });
});
