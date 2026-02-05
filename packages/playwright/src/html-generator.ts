import type { ReviewMetadata } from "./review-types.ts";

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
    .review-layout { display: flex; height: calc(100vh - 60px); }
    .video-panel { flex: 4; padding: 1rem; display: flex; align-items: center; justify-content: center; background: #0f0f23; }
    .video-panel video { width: 100%; max-height: 100%; border-radius: 4px; }
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
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
  </header>
  <main class="review-layout">
    <div class="video-panel">
      <video id="review-video" controls src="${escapeAttr(firstDemo.file)}"></video>
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
  </main>
  <script>
    (function() {
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
    })();
  </script>
</body>
</html>`;
}
