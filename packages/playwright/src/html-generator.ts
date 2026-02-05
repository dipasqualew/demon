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
    #annotations-list { list-style: none; }
    #annotations-list li { margin-bottom: 0.3rem; }
    #annotations-list button { width: 100%; text-align: left; padding: 0.3rem 0.5rem; background: transparent; color: #53a8b6; border: none; cursor: pointer; font-size: 0.85rem; }
    #annotations-list button:hover { color: #e94560; text-decoration: underline; }
    .timestamp { font-weight: bold; margin-right: 0.4rem; color: #e94560; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
  </header>
  <main class="review-layout">
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
      <section>
        <h2>Annotations</h2>
        <ul id="annotations-list"></ul>
      </section>
    </div>
  </main>
  <script>
    (function() {
      var metadata = ${metadataJson};
      var video = document.getElementById("review-video");
      var summaryText = document.getElementById("summary-text");
      var annotationsList = document.getElementById("annotations-list");
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

        var html = "";
        demo.annotations.forEach(function(ann) {
          html += '<li><button data-time="' + ann.timestampSeconds + '">' +
            '<span class="timestamp">' + esc(formatTime(ann.timestampSeconds)) + '</span>' +
            esc(ann.text) + '</button></li>';
        });
        annotationsList.innerHTML = html;
      }

      demoButtons.forEach(function(btn) {
        btn.addEventListener("click", function() {
          selectDemo(parseInt(btn.getAttribute("data-index"), 10));
        });
      });

      annotationsList.addEventListener("click", function(e) {
        var btn = e.target.closest("button[data-time]");
        if (btn) {
          video.currentTime = parseFloat(btn.getAttribute("data-time"));
          video.play();
        }
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
    })();
  </script>
</body>
</html>`;
}
