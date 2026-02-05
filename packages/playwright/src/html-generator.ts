import type { ReviewMetadata, CodeReview } from "./review-types.ts";

export interface GenerateReviewHtmlOptions {
  metadata: ReviewMetadata;
  title?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function renderReviewSection(review: CodeReview): string {
  const bannerClass = review.verdict === "approve" ? "approve" : "request-changes";
  const verdictLabel = review.verdict === "approve" ? "Approved" : "Changes Requested";

  const highlightsHtml = review.highlights
    .map((h) => `<li>${escapeHtml(h)}</li>`)
    .join("\n          ");

  const issuesHtml = review.issues.length > 0
    ? review.issues
        .map((issue) => {
          const badgeLabel = issue.severity.toUpperCase();
          return `<div class="issue ${issue.severity}"><span class="severity-badge">${badgeLabel}</span> <span class="issue-text">${escapeHtml(issue.description)}</span><button class="feedback-add-issue" data-issue="${escapeAttr(issue.description)}">+</button></div>`;
        })
        .join("\n        ")
    : '<p class="no-issues">No issues found.</p>';

  return `<section class="review-section">
      <div class="verdict-banner ${bannerClass}">
        <strong>${verdictLabel}</strong>: ${escapeHtml(review.verdictReason)}
      </div>
      <div class="review-body">
        <h2>Summary</h2>
        <p>${escapeHtml(review.summary)}</p>
        <h2>Highlights</h2>
        <ul class="highlights-list">
          ${highlightsHtml}
        </ul>
        <h2>Issues</h2>
        ${issuesHtml}
      </div>
    </section>`;
}

export function generateReviewHtml(options: GenerateReviewHtmlOptions): string {
  const { metadata, title = "Demo Review" } = options;

  if (metadata.demos.length === 0) {
    throw new Error("metadata.demos must not be empty");
  }

  const firstDemo = metadata.demos[0];

  const demoButtons = metadata.demos
    .map((demo, i) => {
      const activeClass = i === 0 ? ' class="active"' : "";
      return `<li><button data-index="${i}"${activeClass}>${escapeHtml(demo.file)}</button></li>`;
    })
    .join("\n            ");

  const metadataJson = JSON.stringify(metadata).replace(/<\//g, "<\\/");

  const reviewHtml = metadata.review ? renderReviewSection(metadata.review) : "";
  const hasReview = !!metadata.review;
  const defaultTab = hasReview ? "summary" : "demos";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #1a1a2e; color: #e0e0e0; min-height: 100vh; }
    header { padding: 1rem 2rem; background: #16213e; border-bottom: 1px solid #0f3460; }
    header h1 { font-size: 1.4rem; color: #e94560; }
    .tab-bar { display: flex; gap: 0; background: #16213e; border-bottom: 2px solid #0f3460; padding: 0 2rem; }
    .tab-btn { padding: 0.7rem 1.5rem; background: none; border: none; border-bottom: 3px solid transparent; color: #999; font-size: 0.95rem; cursor: pointer; font-family: inherit; transition: all 0.15s; margin-bottom: -2px; }
    .tab-btn:hover { color: #e0e0e0; }
    .tab-btn.active { color: #e94560; border-bottom-color: #e94560; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .review-section { padding: 1.5rem 2rem; }
    .verdict-banner { padding: 1rem 1.5rem; border-radius: 6px; font-size: 1rem; margin-bottom: 1.5rem; }
    .verdict-banner.approve { background: #1b4332; border: 1px solid #2d6a4f; color: #95d5b2; }
    .verdict-banner.request-changes { background: #4a1520; border: 1px solid #842029; color: #f5c6cb; }
    .review-body { max-width: 900px; }
    .review-body h2 { font-size: 1.1rem; color: #e94560; margin: 1.2rem 0 0.5rem; }
    .review-body p { font-size: 0.95rem; line-height: 1.6; color: #ccc; }
    .highlights-list { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
    .highlights-list li { font-size: 0.95rem; line-height: 1.5; color: #95d5b2; margin-bottom: 0.3rem; }
    .issue { padding: 0.6rem 0.8rem; margin-bottom: 0.5rem; border-radius: 4px; font-size: 0.9rem; line-height: 1.4; }
    .issue.major { background: rgba(132, 32, 41, 0.3); border-left: 4px solid #dc3545; }
    .issue.minor { background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; }
    .issue.nit { background: rgba(108, 117, 125, 0.2); border-left: 4px solid #6c757d; }
    .severity-badge { display: inline-block; font-size: 0.7rem; font-weight: bold; padding: 0.15rem 0.4rem; border-radius: 3px; margin-right: 0.5rem; vertical-align: middle; }
    .issue.major .severity-badge { background: #dc3545; color: #fff; }
    .issue.minor .severity-badge { background: #ffc107; color: #000; }
    .issue.nit .severity-badge { background: #6c757d; color: #fff; }
    .no-issues { color: #95d5b2; font-style: italic; }
    .demos-section { padding: 1rem 0; }
    .review-layout { display: flex; height: 600px; }
    .video-panel { flex: 4; padding: 1rem; display: flex; align-items: center; justify-content: center; background: #0f0f23; }
    .video-wrapper { position: relative; width: 100%; max-height: 100%; display: flex; flex-direction: column; }
    .video-wrapper video { width: 100%; max-height: calc(100% - 36px); border-radius: 4px 4px 0 0; display: block; cursor: pointer; }
    .video-controls { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #16213e; border-radius: 0 0 4px 4px; }
    .video-controls button { background: none; border: none; color: #e0e0e0; cursor: pointer; font-size: 1rem; padding: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
    .video-controls button:hover { color: #e94560; }
    .video-controls input[type="range"] { flex: 1; height: 4px; accent-color: #e94560; cursor: pointer; }
    .video-controls .vc-time { font-size: 0.75rem; color: #999; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .side-panel { flex: 1; min-width: 260px; max-width: 360px; padding: 1rem; overflow-y: auto; background: #16213e; border-left: 1px solid #0f3460; }
    .side-panel h2 { font-size: 1rem; margin-bottom: 0.5rem; color: #e94560; }
    .side-panel section { margin-bottom: 1.5rem; }
    #demo-list { list-style: none; }
    #demo-list li { margin-bottom: 0.25rem; }
    #demo-list button { width: 100%; text-align: left; padding: 0.4rem 0.6rem; background: #1a1a2e; color: #e0e0e0; border: 1px solid #0f3460; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
    #demo-list button:hover { background: #0f3460; }
    #demo-list button.active { background: #e94560; color: #fff; border-color: #e94560; }
    #summary-text { font-size: 0.9rem; line-height: 1.5; color: #ccc; }
    #steps-list { list-style: none; }
    #steps-list li { margin-bottom: 0.3rem; }
    #steps-list button { width: 100%; text-align: left; padding: 0.4rem 0.6rem; background: transparent; color: #53a8b6; border: none; border-left: 3px solid transparent; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
    #steps-list button:hover { color: #e94560; }
    #steps-list button.step-active { background: rgba(233, 69, 96, 0.15); color: #e94560; border-left-color: #e94560; }
    .timestamp { font-weight: bold; margin-right: 0.4rem; color: #e94560; }
    .issue { position: relative; }
    .feedback-add-issue { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: none; border: 1px solid #53a8b6; color: #53a8b6; border-radius: 4px; cursor: pointer; font-size: 0.85rem; padding: 0.1rem 0.45rem; line-height: 1; }
    .feedback-add-issue:hover { background: #53a8b6; color: #1a1a2e; }
    #feedback-selection-btn { display: none; position: absolute; z-index: 1000; padding: 0.35rem 0.7rem; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; }
    .feedback-layout { display: flex; gap: 1.5rem; padding: 1.5rem 2rem; }
    .feedback-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
    .feedback-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    #feedback-list { list-style: none; padding: 0; }
    #feedback-list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: #16213e; border: 1px solid #0f3460; border-radius: 4px; margin-bottom: 0.4rem; font-size: 0.9rem; }
    #feedback-list li span { flex: 1; }
    .feedback-remove { background: none; border: none; color: #dc3545; cursor: pointer; font-size: 0.9rem; padding: 0 0.3rem; }
    .feedback-remove:hover { color: #ff6b7a; }
    #feedback-general { width: 100%; min-height: 100px; background: #16213e; color: #e0e0e0; border: 1px solid #0f3460; border-radius: 4px; padding: 0.6rem; font-family: inherit; font-size: 0.9rem; resize: vertical; }
    #feedback-preview { background: #0f0f23; color: #ccc; border: 1px solid #0f3460; border-radius: 4px; padding: 1rem; white-space: pre-wrap; font-size: 0.85rem; line-height: 1.5; flex: 1; min-height: 200px; overflow-y: auto; }
    #feedback-copy { align-self: flex-end; padding: 0.5rem 1rem; background: none; border: 1px solid #53a8b6; color: #53a8b6; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
    #feedback-copy:hover { background: #53a8b6; color: #1a1a2e; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
  </header>
  <nav class="tab-bar">
    ${hasReview ? `<button class="tab-btn${defaultTab === "summary" ? " active" : ""}" data-tab="summary">Summary</button>` : ""}
    <button class="tab-btn${defaultTab === "demos" ? " active" : ""}" data-tab="demos">Demos</button>
    ${hasReview ? `<button class="tab-btn" data-tab="feedback">Feedback</button>` : ""}
  </nav>
  <main>
    ${hasReview ? `<div id="tab-summary" class="tab-panel${defaultTab === "summary" ? " active" : ""}">
    ${reviewHtml}
    </div>` : ""}
    <div id="tab-demos" class="tab-panel${defaultTab === "demos" ? " active" : ""}">
    <section class="demos-section">
      <div class="review-layout">
        <div class="video-panel">
          <div class="video-wrapper">
            <video id="review-video" src="${escapeAttr(firstDemo.file)}"></video>
            <div class="video-controls">
              <button id="vc-play" aria-label="Play">&#9654;</button>
              <input id="vc-seek" type="range" min="0" max="100" value="0" step="0.1">
              <span class="vc-time" id="vc-time">0:00 / 0:00</span>
            </div>
          </div>
        </div>
        <div class="side-panel">
          <section>
            <h2>Demos</h2>
            <ul id="demo-list">
            ${demoButtons}
            </ul>
          </section>
          <section>
            <h2>Summary</h2>
            <p id="summary-text"></p>
          </section>
          <section id="steps-section">
            <h2>Steps</h2>
            <ul id="steps-list"></ul>
          </section>
        </div>
      </div>
    </section>
    </div>
    ${hasReview ? `<div id="tab-feedback" class="tab-panel">
      <div class="feedback-layout">
        <div class="feedback-left">
          <h2>Feedback Items</h2>
          <ul id="feedback-list"></ul>
          <h2>General Feedback</h2>
          <textarea id="feedback-general" placeholder="Add general feedback here..."></textarea>
        </div>
        <div class="feedback-right">
          <h2>Preview</h2>
          <pre id="feedback-preview"></pre>
          <button id="feedback-copy">Copy to clipboard</button>
        </div>
      </div>
    </div>` : ""}
  </main>
  ${hasReview ? `<button id="feedback-selection-btn">Add to feedback</button>` : ""}
  <script>
    (function() {
      // Tab switching
      var tabBtns = document.querySelectorAll(".tab-btn");
      var tabPanels = document.querySelectorAll(".tab-panel");
      tabBtns.forEach(function(btn) {
        btn.addEventListener("click", function() {
          var target = btn.getAttribute("data-tab");
          tabBtns.forEach(function(b) { b.classList.toggle("active", b === btn); });
          tabPanels.forEach(function(p) { p.classList.toggle("active", p.id === "tab-" + target); });
        });
      });

      var metadata = ${metadataJson};
      var video = document.getElementById("review-video");
      var summaryText = document.getElementById("summary-text");
      var stepsList = document.getElementById("steps-list");
      var demoButtons = document.querySelectorAll("#demo-list button");

      function esc(s) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
      }

      function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return m + ":" + (s < 10 ? "0" : "") + s;
      }

      function selectDemo(index) {
        var demo = metadata.demos[index];
        video.src = demo.file;
        video.load();
        summaryText.textContent = demo.summary;

        demoButtons.forEach(function(btn, i) {
          btn.classList.toggle("active", i === index);
        });

        var stepsHtml = "";
        demo.steps.forEach(function(step) {
          stepsHtml += '<li><button data-time="' + step.timestampSeconds + '">' +
            '<span class="timestamp">' + esc(formatTime(step.timestampSeconds)) + '</span>' +
            esc(step.text) + '</button></li>';
        });
        stepsList.innerHTML = stepsHtml;
      }

      demoButtons.forEach(function(btn) {
        btn.addEventListener("click", function() {
          selectDemo(parseInt(btn.getAttribute("data-index"), 10));
        });
      });

      stepsList.addEventListener("click", function(e) {
        var btn = e.target.closest("button[data-time]");
        if (btn) {
          video.currentTime = parseFloat(btn.getAttribute("data-time"));
          video.play();
        }
      });

      video.addEventListener("timeupdate", function() {
        var buttons = document.querySelectorAll("#steps-list button[data-time]");
        var ct = video.currentTime;
        var activeIdx = -1;
        buttons.forEach(function(btn, i) {
          if (parseFloat(btn.getAttribute("data-time")) <= ct) activeIdx = i;
          btn.classList.remove("step-active");
        });
        if (activeIdx >= 0) buttons[activeIdx].classList.add("step-active");
      });

      selectDemo(0);

      // Custom video controls
      var playBtn = document.getElementById("vc-play");
      var seekBar = document.getElementById("vc-seek");
      var timeDisplay = document.getElementById("vc-time");
      var seeking = false;

      function fmtTime(sec) {
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ":" + (s < 10 ? "0" : "") + s;
      }

      function updateTime() {
        var cur = video.currentTime || 0;
        var dur = video.duration || 0;
        timeDisplay.textContent = fmtTime(cur) + " / " + fmtTime(dur);
        if (!seeking && dur) seekBar.value = (cur / dur) * 100;
      }

      function updatePlayBtn() {
        playBtn.innerHTML = video.paused ? "&#9654;" : "&#9646;&#9646;";
      }

      playBtn.addEventListener("click", function() {
        video.paused ? video.play() : video.pause();
      });
      video.addEventListener("click", function() {
        video.paused ? video.play() : video.pause();
      });
      video.addEventListener("play", updatePlayBtn);
      video.addEventListener("pause", updatePlayBtn);
      video.addEventListener("ended", updatePlayBtn);
      video.addEventListener("timeupdate", updateTime);
      video.addEventListener("loadedmetadata", updateTime);

      seekBar.addEventListener("input", function() {
        seeking = true;
        if (video.duration) {
          video.currentTime = (seekBar.value / 100) * video.duration;
        }
      });
      seekBar.addEventListener("change", function() { seeking = false; });

      // Feedback tab logic
      if (document.getElementById("tab-feedback")) {
        var feedbackItems = [];
        var feedbackList = document.getElementById("feedback-list");
        var feedbackGeneral = document.getElementById("feedback-general");
        var feedbackPreview = document.getElementById("feedback-preview");
        var feedbackCopy = document.getElementById("feedback-copy");
        var selectionBtn = document.getElementById("feedback-selection-btn");

        function addFeedbackItem(text) {
          var trimmed = text.trim();
          if (!trimmed) return;
          for (var i = 0; i < feedbackItems.length; i++) {
            if (feedbackItems[i] === trimmed) return;
          }
          feedbackItems.push(trimmed);
          renderFeedback();
        }

        function removeFeedbackItem(index) {
          feedbackItems.splice(index, 1);
          renderFeedback();
        }

        function renderFeedback() {
          var html = "";
          feedbackItems.forEach(function(item, i) {
            html += '<li><span>' + esc(item) + '</span><button class="feedback-remove" data-index="' + i + '">X</button></li>';
          });
          feedbackList.innerHTML = html;
          updatePreview();
        }

        function updatePreview() {
          var lines = "";
          feedbackItems.forEach(function(item, i) {
            lines += (i + 1) + ". Address: " + item + "\\n";
          });
          var general = feedbackGeneral.value.trim();
          if (general) {
            lines += "\\nGeneral feedback:\\n" + general;
          }
          feedbackPreview.textContent = lines;
        }

        // Issue "+" buttons
        var summaryTab = document.getElementById("tab-summary");
        if (summaryTab) {
          summaryTab.addEventListener("click", function(e) {
            var btn = e.target.closest(".feedback-add-issue");
            if (btn) {
              addFeedbackItem(btn.getAttribute("data-issue"));
            }
          });
        }

        // Text selection floating button
        var selectionTimeout;
        document.addEventListener("mouseup", function(e) {
          clearTimeout(selectionTimeout);
          selectionTimeout = setTimeout(function() {
            var sel = window.getSelection();
            var text = sel ? sel.toString().trim() : "";
            if (!text) return;
            var anchor = sel.anchorNode;
            var inSummary = false;
            var node = anchor;
            while (node) {
              if (node.id === "tab-summary") { inSummary = true; break; }
              node = node.parentNode;
            }
            if (!inSummary) return;
            selectionBtn.style.display = "block";
            selectionBtn.style.left = e.pageX + "px";
            selectionBtn.style.top = (e.pageY - 35) + "px";
            selectionBtn._selectedText = text;
          }, 100);
        });

        selectionBtn.addEventListener("click", function() {
          if (selectionBtn._selectedText) {
            addFeedbackItem(selectionBtn._selectedText);
          }
          selectionBtn.style.display = "none";
          window.getSelection().removeAllRanges();
        });

        document.addEventListener("mousedown", function(e) {
          if (e.target !== selectionBtn) {
            selectionBtn.style.display = "none";
          }
        });

        // Remove buttons
        feedbackList.addEventListener("click", function(e) {
          var btn = e.target.closest(".feedback-remove");
          if (btn) {
            removeFeedbackItem(parseInt(btn.getAttribute("data-index"), 10));
          }
        });

        // Textarea input
        feedbackGeneral.addEventListener("input", updatePreview);

        // Copy button
        feedbackCopy.addEventListener("click", function() {
          var text = feedbackPreview.textContent;
          function onCopied() {
            feedbackCopy.textContent = "Copied!";
            setTimeout(function() { feedbackCopy.textContent = "Copy to clipboard"; }, 1500);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onCopied, onCopied);
          } else {
            onCopied();
          }
        });

        renderFeedback();
      }
    })();
  </script>
</body>
</html>`;
}
