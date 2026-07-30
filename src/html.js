function escapeEmbeddedJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeHtmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderHtml(report) {
  const data = escapeEmbeddedJson(report);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
  <title>${escapeHtmlText(report.config.name)} · SeedSleuth report</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f4f0e7;
      --muted: #9d9a91;
      --panel: #171a19;
      --line: #303632;
      --acid: #d5ff64;
      --ember: #ff835c;
      --cyan: #68d8d6;
      --danger: #ff6b75;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% -10%, #344126 0, transparent 34rem),
        #0c0f0e;
      font: 15px/1.55 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    button, input { font: inherit; }
    .shell { width: min(1220px, calc(100% - 32px)); margin: 0 auto; }
    header { padding: 58px 0 28px; border-bottom: 1px solid var(--line); }
    .eyebrow {
      color: var(--acid);
      font: 700 12px/1.2 ui-monospace, monospace;
      letter-spacing: .18em;
      text-transform: uppercase;
    }
    h1 { max-width: 900px; margin: 12px 0 8px; font-size: clamp(36px, 7vw, 78px); line-height: .95; letter-spacing: -.055em; }
    .lede { max-width: 760px; margin: 20px 0 0; color: var(--muted); font-size: 17px; }
    .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 26px 0; }
    .stat { min-height: 108px; padding: 16px; border: 1px solid var(--line); background: color-mix(in srgb, var(--panel), transparent 8%); }
    .stat strong { display: block; margin-top: 10px; font: 700 31px/1 ui-monospace, monospace; }
    .stat span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .09em; }
    .toolbar { position: sticky; top: 0; z-index: 4; display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 0; background: color-mix(in srgb, #0c0f0e, transparent 6%); backdrop-filter: blur(14px); }
    .toolbar button, .toolbar input {
      min-height: 40px;
      border: 1px solid var(--line);
      color: var(--ink);
      background: #121513;
      padding: 8px 13px;
    }
    .toolbar button { cursor: pointer; }
    .toolbar button.active { border-color: var(--acid); color: #0b0d0c; background: var(--acid); }
    .toolbar input { flex: 1 1 190px; min-width: 160px; }
    .results { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 4px 0 60px; }
    article { overflow: hidden; border: 1px solid var(--line); background: var(--panel); }
    article.failed { border-color: color-mix(in srgb, var(--danger), var(--line)); }
    article.error { border-color: var(--ember); }
    .card-head { display: flex; align-items: start; justify-content: space-between; gap: 20px; padding: 16px; border-bottom: 1px solid var(--line); }
    .seed { font: 750 25px/1 ui-monospace, monospace; }
    .status { border: 1px solid currentColor; padding: 4px 7px; font: 700 11px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
    .passed .status { color: var(--acid); }
    .failed .status { color: var(--danger); }
    .error .status { color: var(--ember); }
    .canvas-wrap { display: grid; min-height: 220px; place-items: center; padding: 16px; background: #090b0a; }
    canvas { width: 100%; max-height: 360px; image-rendering: pixelated; border: 1px solid #222824; }
    .no-map { color: var(--muted); font: 13px ui-monospace, monospace; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .metric { min-width: 0; padding: 10px; background: var(--panel); }
    .metric b { display: block; overflow: hidden; text-overflow: ellipsis; color: var(--muted); font: 10px/1.3 ui-monospace, monospace; text-transform: uppercase; }
    .metric span { display: block; margin-top: 5px; font: 650 14px/1 ui-monospace, monospace; }
    details { padding: 12px 16px 15px; border-top: 1px solid var(--line); }
    summary { cursor: pointer; color: var(--cyan); }
    ul { padding-left: 20px; }
    code { color: var(--acid); font-family: ui-monospace, monospace; }
    .empty { grid-column: 1 / -1; padding: 60px; text-align: center; color: var(--muted); border: 1px dashed var(--line); }
    footer { padding: 26px 0 48px; color: var(--muted); border-top: 1px solid var(--line); }
    @media (max-width: 900px) { .stats { grid-template-columns: repeat(3, 1fr); } .results { grid-template-columns: 1fr; } }
    @media (max-width: 520px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
  </style>
</head>
<body>
  <header>
    <div class="shell">
      <div class="eyebrow">SeedSleuth · procedural world evidence</div>
      <h1 id="title"></h1>
      <p class="lede" id="description"></p>
    </div>
  </header>
  <main class="shell">
    <section class="stats" id="stats"></section>
    <section class="toolbar" aria-label="Report filters">
      <button data-filter="all" class="active">All</button>
      <button data-filter="failed">Violations</button>
      <button data-filter="error">Adapter errors</button>
      <button data-filter="outlier">Outliers</button>
      <input id="seed-search" inputmode="numeric" placeholder="Find seed…">
    </section>
    <section class="results" id="results"></section>
  </main>
  <footer><div class="shell" id="footer"></div></footer>
  <script id="report-data" type="application/json">${data}</script>
  <script>
    const report = JSON.parse(document.getElementById("report-data").textContent);
    const state = { filter: "all", query: "" };
    const palette = {
      "#": "#171a19", ".": "#d7d0bd", "S": "#d5ff64", "E": "#ff835c",
      "K": "#68d8d6", "D": "#b688ff", "~": "#4f8fa6", "^": "#9c7462"
    };
    const escapeHtml = (value) => String(value)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const nice = (value) => typeof value === "number"
      ? (Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\\.$/, ""))
      : String(value);

    document.getElementById("title").textContent = report.config.name;
    document.getElementById("description").textContent =
      report.config.description || "A deterministic sweep of generated game worlds.";
    const statItems = [
      ["Seeds", report.summary.total],
      ["Passed", report.summary.passed],
      ["Violations", report.summary.failed],
      ["Adapter errors", report.summary.adapterErrors],
      ["Outlier seeds", report.summary.outlierSeeds],
      ["p95 / seed", report.summary.durationMs.p95 + " ms"]
    ];
    document.getElementById("stats").innerHTML = statItems.map(([label, value]) =>
      '<div class="stat"><span>' + escapeHtml(label) + '</span><strong>' +
      escapeHtml(value) + '</strong></div>').join("");

    function drawWorld(canvas, world) {
      const scale = Math.max(4, Math.min(16, Math.floor(620 / world.width)));
      canvas.width = world.width * scale;
      canvas.height = world.height * scale;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      world.cells.forEach((row, y) => Array.from(row).forEach((symbol, x) => {
        context.fillStyle = palette[symbol] || "#f0b96a";
        context.fillRect(x * scale, y * scale, scale, scale);
        if (symbol !== "#" && symbol !== ".") {
          context.fillStyle = "#0b0d0c";
          context.font = "bold " + Math.max(6, scale - 2) + "px monospace";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(symbol, x * scale + scale / 2, y * scale + scale / 2 + .5);
        }
      }));
    }

    function matches(result) {
      if (state.query && !String(result.seed).includes(state.query)) return false;
      if (state.filter === "failed") return result.status === "failed";
      if (state.filter === "error") return result.status === "error";
      if (state.filter === "outlier") return result.outliers.length > 0;
      return true;
    }

    function render() {
      const results = report.results.filter(matches);
      const target = document.getElementById("results");
      if (!results.length) {
        target.innerHTML = '<div class="empty">No seeds match this filter.</div>';
        return;
      }
      target.innerHTML = results.map((result) => {
        const metrics = result.metrics ? [
          ["walkable", nice(result.metrics.walkableRatio)],
          ["components", result.metrics.componentCount],
          ["dead ends", result.metrics.deadEnds],
          ["entropy", nice(result.metrics.tileEntropy)]
        ] : [];
        const findings = [
          ...result.violations.map((item) => '<li><code>' + escapeHtml(item.id) +
            '</code> · ' + escapeHtml(item.message) + '</li>'),
          ...result.outliers.map((item) => '<li><code>outlier/' + escapeHtml(item.metric) +
            '</code> · ' + escapeHtml(item.direction) + ' z=' + escapeHtml(nice(item.robustZ)) + '</li>')
        ];
        if (result.adapterError) {
          findings.push('<li><code>' + escapeHtml(result.adapterError.name) + '</code> · ' +
            escapeHtml(result.adapterError.message) + '</li>');
        }
        return '<article class="' + result.status + '">' +
          '<div class="card-head"><div><div class="seed">seed ' + escapeHtml(result.seed) +
          '</div><small>' + escapeHtml(result.durationMs) + ' ms · ' +
          escapeHtml((result.fingerprint || "no fingerprint").slice(0, 12)) +
          '</small></div><span class="status">' + escapeHtml(result.status) + '</span></div>' +
          '<div class="canvas-wrap">' + (result.world
            ? '<canvas data-seed="' + escapeHtml(result.seed) + '" aria-label="World generated by seed ' +
              escapeHtml(result.seed) + '"></canvas>'
            : '<div class="no-map">world capture not retained</div>') + '</div>' +
          (metrics.length ? '<div class="metrics">' + metrics.map(([label, value]) =>
            '<div class="metric"><b>' + escapeHtml(label) + '</b><span>' +
            escapeHtml(value) + '</span></div>').join("") + '</div>' : '') +
          (findings.length ? '<details><summary>' + findings.length +
            ' finding(s)</summary><ul>' + findings.join("") + '</ul></details>' : '') +
          '</article>';
      }).join("");
      for (const canvas of target.querySelectorAll("canvas")) {
        const result = results.find((candidate) => String(candidate.seed) === canvas.dataset.seed);
        drawWorld(canvas, result.world);
      }
    }

    for (const button of document.querySelectorAll("[data-filter]")) {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach((item) =>
          item.classList.toggle("active", item === button));
        render();
      });
    }
    document.getElementById("seed-search").addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      render();
    });
    document.getElementById("footer").textContent =
      "Generated " + report.generatedAt + " with SeedSleuth " + report.toolVersion +
      " · config " + report.configFingerprint.slice(0, 12) +
      " · fully offline report";
    render();
  </script>
</body>
</html>
`;
}
