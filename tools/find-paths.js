// Nano Wiki Race — path-finder (browser tool).
// Builds pairs.js by searching for short Wikipedia paths between start and
// target candidates. Bidirectional BFS with depth 1 on each side (so paths of
// length 1 or 2 are found cheaply); optional one-extra-step probe pushes to 3.
(function () {
  const statusEl = document.getElementById("status");
  const resultsBody = document.querySelector("#results tbody");
  const runBtn = document.getElementById("run-btn");
  const stopBtn = document.getElementById("stop-btn");
  const dlBtn = document.getElementById("download-btn");

  let stopFlag = false;
  const linksCache = new Map(); // title -> Set of outgoing /wiki/ titles
  const backlinksCache = new Map(); // title -> Set of titles that link here

  function log(msg) {
    const line = "[" + new Date().toLocaleTimeString() + "] " + msg;
    statusEl.textContent += line + "\n";
    statusEl.scrollTop = statusEl.scrollHeight;
    console.log(line);
  }

  function host() {
    return document.getElementById("host").value.trim() || "en.wikipedia.org";
  }

  function normalizeTitle(t) {
    if (!t) return "";
    let s = String(t).replace(/_/g, " ").trim();
    if (!s) return "";
    return s[0].toUpperCase() + s.slice(1);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function apiCall(params) {
    const url =
      "https://" +
      host() +
      "/w/api.php?" +
      new URLSearchParams(
        Object.assign(
          { format: "json", formatversion: "2", origin: "*" },
          params
        )
      ).toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    return await res.json();
  }

  // Get all mainspace outgoing links from a page.
  async function getLinks(title) {
    const key = normalizeTitle(title);
    if (linksCache.has(key)) return linksCache.get(key);
    const out = new Set();
    let cont = null;
    for (let i = 0; i < 20; i++) {
      if (stopFlag) break;
      const params = {
        action: "query",
        titles: title,
        prop: "links",
        plnamespace: "0",
        pllimit: "max",
        redirects: "1",
      };
      if (cont) Object.assign(params, cont);
      const data = await apiCall(params);
      const pages = (data.query && data.query.pages) || [];
      for (const p of pages) {
        if (p.links) for (const l of p.links) out.add(normalizeTitle(l.title));
      }
      if (!data.continue) break;
      cont = data.continue;
      await sleep(50);
    }
    linksCache.set(key, out);
    return out;
  }

  // Get mainspace pages that link to this page.
  async function getBacklinks(title) {
    const key = normalizeTitle(title);
    if (backlinksCache.has(key)) return backlinksCache.get(key);
    const out = new Set();
    let cont = null;
    for (let i = 0; i < 20; i++) {
      if (stopFlag) break;
      const params = {
        action: "query",
        list: "backlinks",
        bltitle: title,
        blnamespace: "0",
        bllimit: "max",
        blfilterredir: "nonredirects",
      };
      if (cont) Object.assign(params, cont);
      const data = await apiCall(params);
      const items = (data.query && data.query.backlinks) || [];
      for (const b of items) out.add(normalizeTitle(b.title));
      if (!data.continue) break;
      cont = data.continue;
      await sleep(50);
    }
    backlinksCache.set(key, out);
    return out;
  }

  async function findPath(start, target, try3) {
    const S = normalizeTitle(start);
    const T = normalizeTitle(target);
    if (S === T) return [S];

    // 1-click probe
    log("  → fetching links from " + S);
    const fwd1 = await getLinks(S);
    if (fwd1.has(T)) return [S, T];

    // 2-click via intersection of fwd1 and backlinks of T
    log("  → fetching backlinks of " + T);
    const bwd1 = await getBacklinks(T);
    const intersect = [];
    for (const x of fwd1) if (bwd1.has(x)) intersect.push(x);
    if (intersect.length) {
      // Prefer a short, nice-looking title (shortest string).
      intersect.sort((a, b) => a.length - b.length);
      return [S, intersect[0], T];
    }

    if (!try3) return null;

    // 3-click probe: for each candidate X in fwd1 (limited), look at links of X
    // and see if any Y is in bwd1 (meaning X → Y → T). This is expensive, so we
    // only sample a bounded number of X's — prefer the shorter titles first.
    const candidates = Array.from(fwd1).sort((a, b) => a.length - b.length).slice(0, 60);
    log("  → probing " + candidates.length + " candidates for length-3 paths");
    for (const X of candidates) {
      if (stopFlag) return null;
      let fwd2;
      try {
        fwd2 = await getLinks(X);
      } catch (e) {
        continue;
      }
      for (const Y of fwd2) {
        if (bwd1.has(Y) && Y !== S && Y !== T && Y !== X) {
          return [S, X, Y, T];
        }
      }
    }
    return null;
  }

  // Concurrency-limited pool.
  async function runPool(jobs, worker, concurrency) {
    const results = new Array(jobs.length);
    let next = 0;
    async function run() {
      while (!stopFlag) {
        const i = next++;
        if (i >= jobs.length) return;
        try {
          results[i] = await worker(jobs[i], i);
        } catch (e) {
          results[i] = { error: e };
        }
      }
    }
    const workers = [];
    for (let k = 0; k < concurrency; k++) workers.push(run());
    await Promise.all(workers);
    return results;
  }

  function addRow(pair, path) {
    const tr = document.createElement("tr");
    if (!path) tr.classList.add("too-far");
    const clicks = path ? path.length - 1 : "—";
    tr.innerHTML =
      "<td><input type='checkbox' " +
      (path && clicks >= 1 && clicks <= 3 ? "checked" : "") +
      "></td>" +
      "<td>" + escapeHTML(pair.start) + "</td>" +
      "<td>" + escapeHTML(pair.target) + "</td>" +
      "<td>" + clicks + "</td>" +
      "<td class='path-cell'>" +
      (path ? path.map(escapeHTML).join(" → ") : "too far") +
      "</td>" +
      "<td class='fact-cell'><input type='text' placeholder='Fun fact'></td>" +
      "<td class='nano-cell'>" +
      "<div><input type='text' class='emoji-in' placeholder='🦎' maxlength='4'>" +
      "<input type='text' class='size-in' placeholder='~200 nm'></div>" +
      "<input type='text' class='scalelabel-in' placeholder='gecko toe hair tip'>" +
      "</td>";
    tr._pairData = { pair, path };
    resultsBody.appendChild(tr);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  async function runSearch() {
    runBtn.disabled = true;
    stopBtn.disabled = false;
    dlBtn.disabled = true;
    resultsBody.innerHTML = "";
    statusEl.textContent = "";
    stopFlag = false;

    const starts = document.getElementById("starts").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const targets = document.getElementById("targets").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const concurrency = Math.max(1, Math.min(6, parseInt(document.getElementById("concurrency").value, 10) || 2));
    const try3 = document.getElementById("try3").checked;

    const jobs = [];
    for (const s of starts) for (const t of targets) jobs.push({ start: s, target: t });
    log("Searching " + jobs.length + " pairs with concurrency " + concurrency + (try3 ? " (incl. length-3)" : ""));

    await runPool(
      jobs,
      async (pair) => {
        if (stopFlag) return null;
        log(pair.start + " → " + pair.target);
        try {
          const path = await findPath(pair.start, pair.target, try3);
          addRow(pair, path);
          return path;
        } catch (e) {
          log("  ! error: " + (e.message || e));
          addRow(pair, null);
          return null;
        }
      },
      concurrency
    );

    log(stopFlag ? "Stopped." : "Done.");
    runBtn.disabled = false;
    stopBtn.disabled = true;
    dlBtn.disabled = false;
  }

  function downloadPairs() {
    const rows = Array.from(resultsBody.children);
    const kept = [];
    for (const tr of rows) {
      const checked = tr.querySelector("input[type=checkbox]").checked;
      if (!checked) continue;
      const data = tr._pairData;
      if (!data || !data.path) continue;
      const fact = tr.querySelector(".fact-cell input").value.trim();
      const emoji = tr.querySelector(".nano-cell .emoji-in").value.trim();
      const size = tr.querySelector(".nano-cell .size-in").value.trim();
      const scaleLabel = tr.querySelector(".nano-cell .scalelabel-in").value.trim();
      const obj = {
        start: data.pair.start,
        target: data.pair.target,
        shortest: data.path,
      };
      if (fact) obj.fact = fact;
      if (emoji) obj.emoji = emoji;
      if (size) obj.size = size;
      if (scaleLabel) obj.scaleLabel = scaleLabel;
      kept.push(obj);
    }
    const body =
      "// Nano Wiki Race — generated pairs.\n" +
      "window.NWR_PAIRS = " +
      JSON.stringify(kept, null, 2) +
      ";\n";
    const blob = new Blob([body], { type: "application/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pairs.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    log("Downloaded pairs.js with " + kept.length + " pair(s).");
  }

  runBtn.addEventListener("click", runSearch);
  stopBtn.addEventListener("click", () => {
    stopFlag = true;
    log("Stop requested…");
  });
  dlBtn.addEventListener("click", downloadPairs);
})();
