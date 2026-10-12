// Nano Wiki Race — display (info screen).
(function () {
  const PHASES = {
    READY: "ready",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    ENDED: "ended",
  };

  const state = {
    phase: PHASES.READY,
    pair: null,
    path: [],
    endsAt: 0,
    durationMs: 30000,
    result: null,
    shortest: [],
    rafId: 0,
  };

  const root = document.getElementById("display-root");

  // --- rendering ---
  function clear() {
    root.innerHTML = "";
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    if (state.revealResizeObserver) {
      state.revealResizeObserver.disconnect();
      state.revealResizeObserver = null;
    }
    if (state.scaleBarObservers) {
      state.scaleBarObservers.forEach((o) => o.disconnect());
      state.scaleBarObservers = null;
    }
  }

  function renderReady() {
    clear();
    if (!state.pair) {
      root.innerHTML =
        '<div class="d-ready-stack">' +
          '<div class="d-prompt">Nano Wiki Race</div>' +
          '<div class="d-subhead">Waiting for the first round…</div>' +
        '</div>';
      return;
    }
    const html = [
      '<div class="d-ready-stack">',
        '<div class="d-prompt">Nano Wiki Race',
        '<span class="d-tagline">— tiny to huge</span>',
        '</div>',
        '<div class="d-header">',
        escapeHTML(state.pair.start),
        '<span class="arrow">→</span>',
        escapeHTML(state.pair.target),
        "</div>",
        '<div class="d-subhead">Press START on the other screen to begin</div>',
      '</div>',
    ].join("");
    root.innerHTML = html;
    const stack = root.querySelector(".d-ready-stack");
    appendScaleBar(stack);
    appendFactCard(stack);
  }

  function renderCountdown(n) {
    // On subsequent ticks of the same countdown, only update the number node —
    // rebuilding the whole root makes the header and fact card flash once a second.
    const existing = document.getElementById("d-countdown-number");
    if (existing) {
      existing.textContent = n;
      return;
    }
    clear();
    root.innerHTML =
      '<div class="d-header">' +
      escapeHTML(state.pair ? state.pair.start : "") +
      '<span class="arrow">→</span>' +
      escapeHTML(state.pair ? state.pair.target : "") +
      "</div>" +
      '<div class="d-countdown" id="d-countdown-number">' +
      n +
      "</div>";
    appendScaleBar(root);
    appendFactCard(root);
  }

  function renderPlaying() {
    clear();
    const header = document.createElement("div");
    header.className = "d-header";
    header.innerHTML =
      escapeHTML(state.pair.start) +
      '<span class="arrow">→</span>' +
      escapeHTML(state.pair.target);

    const timerWrap = document.createElement("div");
    timerWrap.className = "d-timer-wrap";
    const timer = document.createElement("div");
    timer.className = "d-timer";
    timer.id = "d-timer";
    const barWrap = document.createElement("div");
    barWrap.className = "d-timerbar";
    const barFill = document.createElement("div");
    barFill.className = "d-timerbar-fill";
    barFill.id = "d-timerbar-fill";
    barWrap.appendChild(barFill);
    timerWrap.appendChild(timer);
    timerWrap.appendChild(barWrap);

    const pathLive = document.createElement("div");
    pathLive.className = "d-path-live";
    pathLive.id = "d-path-live";

    root.appendChild(header);
    root.appendChild(timerWrap);
    root.appendChild(pathLive);
    appendFactCard(root);

    renderPathChips(state.path);
    tickTimer();
  }

  function renderPathChips(path) {
    const container = document.getElementById("d-path-live");
    if (!container) return;
    container.innerHTML = "";
    const target = state.pair ? state.pair.target : null;
    path.forEach((title, i) => {
      if (i > 0) {
        const arrow = document.createElement("span");
        arrow.className = "d-chip-arrow";
        arrow.textContent = "→";
        container.appendChild(arrow);
      }
      const chip = document.createElement("span");
      chip.className = "d-chip";
      if (i === 0) chip.classList.add("start");
      if (
        target &&
        wiki.normalizeTitle(title) === wiki.normalizeTitle(target)
      )
        chip.classList.add("target");
      chip.textContent = title;
      container.appendChild(chip);
    });
  }

  function tickTimer() {
    if (state.phase !== PHASES.PLAYING) return;
    const now = performance.now();
    const left = Math.max(0, state.endsAt - now);
    const secs = Math.ceil(left / 1000);
    const timer = document.getElementById("d-timer");
    const bar = document.getElementById("d-timerbar-fill");
    if (timer) {
      timer.textContent = secs;
      if (secs <= 10) timer.classList.add("warn");
      else timer.classList.remove("warn");
    }
    if (bar) {
      const pct = Math.max(0, Math.min(100, (left / state.durationMs) * 100));
      bar.style.width = pct + "%";
      if (secs <= 10) bar.classList.add("warn");
      else bar.classList.remove("warn");
    }
    state.rafId = requestAnimationFrame(tickTimer);
  }

  // --- reveal ---
  function renderEnd() {
    clear();
    const yourPath = state.path.slice();
    const shortest = (state.shortest || []).slice();
    const kidClicks = Math.max(0, yourPath.length - 1);
    const compClicks = Math.max(0, shortest.length - 1);
    const didWin = state.result === "win";
    // Capture the ending pair's start/target NOW. The reveal stays up
    // until the next kid presses START, during which `state.pair` may be
    // swapped to the next round's challenge by the `ready` handler; the
    // reveal must keep painting the pair the kid just played.
    const revealStart = state.pair.start;
    const revealTarget = state.pair.target;

    const header = document.createElement("div");
    header.className = "d-header";
    header.innerHTML =
      escapeHTML(revealStart) +
      '<span class="arrow">→</span>' +
      escapeHTML(revealTarget);
    root.appendChild(header);

    const reveal = document.createElement("div");
    reveal.className = "d-reveal";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.classList.add("d-reveal-svg");
    reveal.appendChild(svg);

    const caption = document.createElement("div");
    caption.className = "d-reveal-caption";
    if (didWin) {
      caption.textContent =
        "You made " +
        kidClicks +
        " click" +
        (kidClicks === 1 ? "" : "s") +
        "! The shortest path we found was " +
        compClicks +
        ".";
    } else {
      caption.textContent =
        "The shortest path we found was " +
        compClicks +
        " click" +
        (compClicks === 1 ? "" : "s") +
        "!";
    }
    reveal.appendChild(caption);

    root.appendChild(reveal);
    appendScaleBar(root);
    appendFactCard(root);

    // Fit the SVG viewBox to the actual reveal container shape so it uses
    // 100% of the available width AND height with no letterboxing. Re-fits
    // whenever the reveal container's size changes (window drag, zoom,
    // factcard growing, etc.).
    let lastW = 0, lastH = 0;
    const fitRevealSvg = () => {
      // Measure the SVG element itself rather than deriving its size from
      // its parent (reveal) minus caption. Direct measurement eliminates
      // any arithmetic mismatch that would cause the viewBox to disagree
      // with the SVG's rendered box — which is what triggers horizontal
      // letterboxing via preserveAspectRatio.
      const svgRect = svg.getBoundingClientRect();
      const availW = Math.max(100, Math.round(svgRect.width));
      const availH = Math.max(60, Math.round(svgRect.height));
      // Skip redraw on sub-pixel jitter so the ResizeObserver can't loop.
      if (Math.abs(availW - lastW) < 2 && Math.abs(availH - lastH) < 2) return;
      lastW = availW; lastH = availH;
      drawRevealContent(svg, availW, availH, yourPath, shortest, didWin, revealStart, revealTarget);
    };
    requestAnimationFrame(fitRevealSvg);
    state.revealResizeObserver = new ResizeObserver(fitRevealSvg);
    state.revealResizeObserver.observe(reveal);
  }

  function drawRevealContent(svg, vbWidth, vbHeight, yourPath, computerPath, didFinish, start, target) {
    svg.setAttribute("viewBox", `0 0 ${vbWidth} ${vbHeight}`);
    svg.innerHTML = "";

    // Normalize both paths to always start with the pair start and end with the pair target.
    function normalizePathForDisplay(p, finished) {
      const nodes = p.slice();
      if (nodes.length === 0) nodes.push(start);
      if (nodes[0] !== start) nodes.unshift(start);
      if (finished && nodes[nodes.length - 1] !== target) nodes.push(target);
      return nodes;
    }

    // Collapse the middle of very long paths so we don't end up with 15 bubbles
    // of unreadable text. Keep the first HEAD and last TAIL nodes; insert an
    // ellipsis marker between them that carries the hidden-count for the "+N
    // more" caption. Only elide when the saving is meaningful (≥ 2 hidden).
    function elidePath(nodes) {
      const HEAD = 5;
      const TAIL = 4;
      const MAX_SHOWN = HEAD + 1 + TAIL; // = 10 slots including the ellipsis
      if (nodes.length <= MAX_SHOWN + 1) return nodes.slice();
      const head = nodes.slice(0, HEAD);
      const tail = nodes.slice(nodes.length - TAIL);
      const hidden = nodes.length - HEAD - TAIL;
      return head.concat([{ ellipsis: true, hidden: hidden }]).concat(tail);
    }

    const yourNodes = elidePath(normalizePathForDisplay(yourPath, didFinish));
    // Computer's lane is short by construction (2–3 nodes), so never elide it.
    const compNodes = normalizePathForDisplay(computerPath, true);

    // Layout in the container's actual pixel space (viewBox = container
    // size), so there's no letterboxing and content fills every pixel.
    // Nodes are offset INWARD from the SVG edge by the ACTUAL node
    // radius, so the first/last node's CIRCLE EDGES land exactly where
    // the scale bar's axis starts/ends. We take two passes: an initial
    // span (using the max possible radius) sizes font / radius; final
    // left/right then use the real radius so there's no leftover gap
    // between a smaller-than-max radius circle and the SVG edge.
    const radiusCapByHeight = Math.min(70, Math.round(vbHeight * 0.14));
    // Horizontal breathing room so the last node's text (text-anchor:end)
    // doesn't butt up against the SVG right edge; also keeps the first-node
    // text (text-anchor:start) from hugging the left edge.
    const edgePad = Math.max(24, Math.round(vbWidth * 0.02));
    const prelimLeft = edgePad + radiusCapByHeight;
    const prelimRight = vbWidth - edgePad - radiusCapByHeight;
    const prelimSpan = prelimRight - prelimLeft;
    const maxLen = Math.max(yourNodes.length, compNodes.length, 2);
    const spacing = prelimSpan / (maxLen - 1);
    const avgCharRatio = 0.55;         // rough glyph-width ÷ font-size for sans-serif
    const slotPad = 0.85;              // leave a bit of air between neighboring labels
    const availableWidth = Math.max(spacing * slotPad, 60);
    // Aim for ~14-char labels; shrink the font until they fit, then clamp.
    // Font is also capped by container height so a short reveal doesn't
    // inflate glyphs past what the lanes can hold.
    const targetChars = 14;
    let fontSize = Math.floor(availableWidth / (targetChars * avgCharRatio));
    fontSize = Math.max(14, Math.min(Math.round(vbHeight * 0.09), 42, fontSize));
    const maxChars = Math.max(6, Math.floor(availableWidth / (fontSize * avgCharRatio)));

    // First / last node labels use text-anchor: start / end, so their text
    // extends unilaterally from the node x. The available width before
    // colliding with the neighbour's centered text slot is ~2/3 of spacing
    // (not slotPad), so we clamp them to a smaller maxChars to prevent
    // visual overlap between e.g. "Lotus effect" and "Ultrahydrophob…".
    const edgeAvailableWidth = Math.max(spacing * 0.66, 50);
    const edgeMaxChars = Math.max(4, Math.floor(edgeAvailableWidth / (fontSize * avgCharRatio)));

    // Lane label font scales with the container so a short-wide reveal
    // doesn't drop the labels to tiny CSS pixels while the node text is huge.
    // On tight vbHeights the labels get dropped entirely so the lanes have
    // room to render without overlapping.
    const laneLabelFontSizeRaw = Math.max(10, Math.min(28, Math.round(vbHeight * 0.06)));
    const laneLabelGapRaw = 6;  // tightened from 10 → 6 so the inter-lane gap is bigger
    const interLaneGap = 10;   // minimum gap between lane 1 text bottom and lane 2 label top
    // Minimum vbHeight that fits two lanes WITH labels. Uses the smallest
    // allowed radius (8) so labels start appearing at tighter heights; the
    // real radius clamp (10 floor) still applies, so a radius of 10 will
    // just use a tiny bit more vertical than the threshold accounts for —
    // acceptable since there's always 2 px of slack built in.
    const minHeightWithLabels = 4 * 8 + 3 * fontSize + 2 * laneLabelFontSizeRaw + 2 * laneLabelGapRaw + interLaneGap + 8;
    const showLabels = vbHeight >= minHeightWithLabels;
    const laneLabelFontSize = showLabels ? laneLabelFontSizeRaw : 0;
    const laneLabelGap = showLabels ? laneLabelGapRaw : 0;

    // Radius is capped by both horizontal spacing AND the vertical budget.
    // Node text uses `dominant-baseline: central`, so its vertical extent is
    // ~1.5 * fontSize below the lane center (not fontSize). Each lane needs:
    //   laneLabelFontSize + laneLabelGap + 2·radius + 1.5·fontSize + 4
    // and two lanes stacked with `interLaneGap` must fit in vbHeight.
    const vertSlack = vbHeight
      - 3 * fontSize
      - 2 * laneLabelFontSize
      - 2 * laneLabelGap
      - interLaneGap
      - 8;
    const radiusVertCap = Math.max(8, Math.floor(vertSlack / 4));
    const radius = Math.max(10, Math.min(
      70,
      Math.round(vbHeight * 0.14),
      spacing * 0.32,
      radiusVertCap
    ));

    // Final horizontal positions using the ACTUAL radius — first/last
    // node circles' outer edges land exactly on `edgePad`, matching
    // the scale bar's axis start/end at the pixel level.
    const left = edgePad + radius;
    const right = vbWidth - edgePad - radius;
    const span = right - left;

    const layout = { left, right, span, fontSize, maxChars, edgeMaxChars, radius, laneLabelFontSize, laneLabelGap };

    // Optional debug overlay: load display.html with ?debug=1 to see the
    // actual rendered dimensions and node positions in the SVG. Useful for
    // diagnosing "the path doesn't stretch far enough" complaints.
    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      const svgNS2 = "http://www.w3.org/2000/svg";
      const dbg = document.createElementNS(svgNS2, "text");
      dbg.setAttribute("x", 8);
      dbg.setAttribute("y", vbHeight - 6);
      dbg.setAttribute("font-size", 13);
      dbg.setAttribute("fill", "#ffd166");
      dbg.setAttribute("font-family", "monospace");
      dbg.textContent =
        `vbW=${vbWidth} vbH=${vbHeight} edgePad=${edgePad} radius=${radius}` +
        ` left=${left} right=${right} span=${span} nodes=${yourNodes.length}/${compNodes.length}`;
      svg.appendChild(dbg);
      // Also outline the first/last node circles' extent in a thin cyan line.
      [left - radius, right + radius].forEach((x) => {
        const line = document.createElementNS(svgNS2, "line");
        line.setAttribute("x1", x); line.setAttribute("y1", 0);
        line.setAttribute("x2", x); line.setAttribute("y2", vbHeight);
        line.setAttribute("stroke", "#06d6a0");
        line.setAttribute("stroke-width", 1);
        line.setAttribute("stroke-dasharray", "4 4");
        svg.appendChild(line);
      });

      // After layout settles, measure the ACTUAL rendered pixel positions
      // of the dashed green lines and compare them to the reveal (red box)
      // edges. Dumps the numbers to a fixed overlay in the top-left corner
      // so there's a concrete comparison between "where the code puts them"
      // and "where the browser actually renders them".
      requestAnimationFrame(() => {
        const reveal = svg.parentElement;
        const revealRect = reveal.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const dashes = svg.querySelectorAll('line[stroke="#06d6a0"]');
        if (dashes.length < 2) return;
        const firstDashRect = dashes[0].getBoundingClientRect();
        const lastDashRect  = dashes[1].getBoundingClientRect();

        const existing = document.getElementById("nwr-debug-overlay");
        if (existing) existing.remove();
        const panel = document.createElement("div");
        panel.id = "nwr-debug-overlay";
        panel.style.cssText =
          "position:fixed;top:4px;right:4px;background:#000c;color:#ffd166;" +
          "font-family:monospace;font-size:11px;line-height:1.4;padding:8px 10px;" +
          "z-index:9999;white-space:pre;border:1px solid #06d6a0;max-width:420px";
        const g = (a, b) => Math.round((b - a) * 10) / 10;
        const wDiff = Math.abs(svgRect.width - vbWidth);
        const hDiff = Math.abs(svgRect.height - vbHeight);
        panel.textContent = [
          `VIEWBOX:  w=${vbWidth} h=${vbHeight}  (code-set)`,
          `SVG box:  w=${Math.round(svgRect.width)} h=${Math.round(svgRect.height)}  (rendered)`,
          `         ${wDiff < 2 && hDiff < 2 ? "✓ MATCH — no letterbox" : "✗ MISMATCH — this is why letterbox!"}`,
          ``,
          `REAL PIXELS (getBoundingClientRect):`,
          `  reveal (red):   left=${Math.round(revealRect.left)} right=${Math.round(revealRect.right)} width=${Math.round(revealRect.width)} height=${Math.round(revealRect.height)}`,
          `  svg:            left=${Math.round(svgRect.left)}    right=${Math.round(svgRect.right)}    width=${Math.round(svgRect.width)}    height=${Math.round(svgRect.height)}`,
          `  first dash:     x=${Math.round(firstDashRect.left)}`,
          `  last dash:      x=${Math.round(lastDashRect.left)}`,
          ``,
          `GAPS (px):`,
          `  reveal.left → svg.left   : ${g(revealRect.left, svgRect.left)}`,
          `  svg.left    → firstDash  : ${g(svgRect.left, firstDashRect.left)}`,
          `  firstDash   → lastDash   : ${g(firstDashRect.left, lastDashRect.left)}`,
          `  lastDash    → svg.right  : ${g(lastDashRect.left, svgRect.right)}`,
          `  svg.right   → reveal.right: ${g(svgRect.right, revealRect.right)}`,
          ``,
          `edgePad=${edgePad} radius=${radius}`,
          `IF viewBox != SVG box above, that's the letterbox cause.`,
        ].join("\n");
        document.body.appendChild(panel);
      });
    }

    // Pack lane 1 against the top (just enough room for its label), lane 2
    // against the bottom (just enough room for its node text). This leaves
    // the maximum possible gap in the middle, so lane 2's label never gets
    // eaten by lane 1's node text.
    // `topPad` / `botPad` reserve a few pixels of breathing room above /
    // below the outermost nodes so a node's stroke never gets clipped at
    // the viewBox edge, even when labels are hidden on tight viewports.
    const topPad = showLabels ? 0 : 4;
    const botPad = showLabels ? 0 : 4;
    const laneTopY = topPad + radius + laneLabelGap + laneLabelFontSize;
    const laneBotY = vbHeight - botPad - radius - Math.ceil(1.5 * fontSize) - 4;
    drawLane(svg, yourNodes, laneTopY, "Your path", "your", !didFinish, layout);
    drawLane(svg, compNodes, laneBotY, "Shortest path we found", "computer", false, layout);
  }

  function drawLane(svg, nodes, y, label, cls, dashedTail, layout) {
    const svgNS = "http://www.w3.org/2000/svg";
    const { left, span, fontSize, maxChars, edgeMaxChars, radius, laneLabelFontSize, laneLabelGap } = layout;

    if (laneLabelFontSize > 0) {
      const lbl = document.createElementNS(svgNS, "text");
      lbl.setAttribute("x", left);
      lbl.setAttribute("y", y - radius - laneLabelGap);
      lbl.setAttribute("font-size", laneLabelFontSize);
      lbl.setAttribute("class", "d-lane-label");
      lbl.textContent = label;
      svg.appendChild(lbl);
    }

    // Stretch each lane across the full span so start / target line up
    // vertically across the two lanes even if their internal node counts differ.
    const n = Math.max(nodes.length, 2);
    const xs = nodes.map((_, i) => left + (span * i) / (n - 1));

    function isEllipsis(item) {
      return item && typeof item === "object" && item.ellipsis === true;
    }

    // Edges between consecutive nodes.
    for (let i = 0; i < nodes.length - 1; i++) {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", xs[i]);
      line.setAttribute("y1", y);
      line.setAttribute("x2", xs[i + 1]);
      line.setAttribute("y2", y);
      let edgeClass = "d-edge " + cls;
      // If the "your" path didn't finish, the final edge (into the forced target)
      // should be dashed to signal "didn't get here".
      if (dashedTail && i === nodes.length - 2) edgeClass += " dashed";
      // Edges touching the ellipsis slot get a lighter dotted style so the
      // "jumped over some clicks" story reads at a glance.
      if (isEllipsis(nodes[i]) || isEllipsis(nodes[i + 1])) edgeClass += " jump";
      line.setAttribute("class", edgeClass);
      svg.appendChild(line);
    }

    // Nodes
    nodes.forEach((item, i) => {
      if (isEllipsis(item)) {
        drawEllipsisNode(svg, xs[i], y, radius, fontSize, item.hidden);
        return;
      }
      const title = item;
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", xs[i]);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", radius);
      let nodeClass = "d-node";
      if (i === 0) nodeClass += " start";
      if (i === nodes.length - 1) nodeClass += " target";
      circle.setAttribute("class", nodeClass);
      svg.appendChild(circle);

      // Label below the node for readability. Font size and truncation adapt
      // to the per-node slot width so an 8-node path doesn't smush text.
      // First/last nodes use start/end anchors so a long label can't extend
      // past the viewBox's left/right edges on a narrow container.
      // NOTE: `.d-node-text { text-anchor: middle }` in CSS has higher
      // specificity than an SVG `text-anchor` attribute, so we have to set
      // the override as an inline style to actually win the cascade.
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", xs[i]);
      text.setAttribute("y", y + radius + fontSize + 4);
      text.setAttribute("class", "d-node-text");
      text.setAttribute("font-size", fontSize);
      const isEdge = (i === 0 || i === nodes.length - 1) && nodes.length > 1;
      if (i === 0) text.style.textAnchor = "start";
      else if (i === nodes.length - 1) text.style.textAnchor = "end";
      // Edge nodes use a tighter maxChars so their unilaterally-extending
      // text can't overlap the next node's centered text slot.
      const limit = isEdge ? edgeMaxChars : maxChars;
      const t = title.length > limit
        ? title.slice(0, Math.max(1, limit - 1)) + "…"
        : title;
      text.textContent = t;
      svg.appendChild(text);
    });
  }

  function drawEllipsisNode(svg, cx, cy, radius, fontSize, hidden) {
    const svgNS = "http://www.w3.org/2000/svg";
    const r = radius * 0.72;
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", r);
    circle.setAttribute("class", "d-node ellipsis");
    svg.appendChild(circle);

    const dots = document.createElementNS(svgNS, "text");
    dots.setAttribute("x", cx);
    dots.setAttribute("y", cy);
    dots.setAttribute("class", "d-node-text ellipsis");
    dots.setAttribute("font-size", Math.round(fontSize * 1.6));
    dots.textContent = "…";
    svg.appendChild(dots);

    const sub = document.createElementNS(svgNS, "text");
    sub.setAttribute("x", cx);
    sub.setAttribute("y", cy + radius + fontSize + 4);
    sub.setAttribute("class", "d-node-text sub");
    sub.setAttribute("font-size", Math.round(fontSize * 0.9));
    sub.textContent = "+" + hidden + " more click" + (hidden === 1 ? "" : "s");
    svg.appendChild(sub);
  }

  // Scale bar — horizontal log axis from 1e-10 m (atom) to 1e10 m (bigger
  // than the Sun), with fixed reference anchors and the current pair's
  // start/target plotted as colored dots. Shows the "tiny to huge" range
  // visually; rendered on READY / COUNTDOWN / ENDED (skipped on PLAYING to
  // keep the race screen uncluttered).
  const SCALE_ANCHORS = [
    { m: 1e-10, text: "atom" },
    { m: 1e-9,  text: "DNA" },
    { m: 1e-6,  text: "microbe" },
    { m: 1e-4,  text: "hair" },
    { m: 1e-3,  text: "sand" },
    { m: 1,     text: "you" },
    { m: 1e2,   text: "skyscraper" },
    { m: 1e4,   text: "mountain" },
    { m: 1e7,   text: "Earth" },
    { m: 1e9,   text: "Sun" },
  ];
  // Range extended 1 log unit below atom so there's a short unlabeled stub
  // before atom that mirrors the one past Sun — the axis is visually
  // symmetric and quietly hints "there's smaller stuff below atom" without
  // adding any new labels or extending the axis's pixel length.
  const SCALE_LOG_MIN = -11;
  const SCALE_LOG_MAX = 10;

  function appendScaleBar(container) {
    const pair = state.pair;
    if (!pair) return;
    if (typeof pair.startMeters !== "number" || typeof pair.targetMeters !== "number") return;

    const svgNS = "http://www.w3.org/2000/svg";

    const wrap = document.createElement("div");
    wrap.className = "d-scalebar";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    wrap.appendChild(svg);
    container.appendChild(wrap);

    // Capture pair values at build time so the drawing is immune to a
    // later `ready` message swapping `state.pair` for the next round
    // (same safety trick as the reveal SVG).
    const info = {
      startMeters:  pair.startMeters,
      targetMeters: pair.targetMeters,
      size:         pair.size       || "",
      scaleLabel:   pair.scaleLabel || "",
      targetSize:   pair.targetSize || "",
      targetLabel:  pair.targetLabel|| "",
    };

    // Fit the scale-bar viewBox to the actual rendered container width so
    // the axis stretches horizontally with the window (anchors spread,
    // pair dots spread) while text and tick sizes stay stable.
    let lastW = 0;
    const fitScaleBar = () => {
      const w = Math.max(400, Math.round(wrap.getBoundingClientRect().width));
      if (Math.abs(w - lastW) < 2) return;
      lastW = w;
      drawScaleBarContent(svg, w, 170, info);
    };
    requestAnimationFrame(fitScaleBar);
    const observer = new ResizeObserver(fitScaleBar);
    observer.observe(wrap);
    if (!state.scaleBarObservers) state.scaleBarObservers = [];
    state.scaleBarObservers.push(observer);
  }

  function drawScaleBarContent(svg, vbWidth, vbHeight, info) {
    const svgNS = "http://www.w3.org/2000/svg";
    svg.setAttribute("viewBox", `0 0 ${vbWidth} ${vbHeight}`);
    svg.innerHTML = "";

    // Same `edgePad` formula as the reveal, so the scale-bar axis starts
    // and ends exactly where the reveal's first/last node circles touch
    // the edge of the drawing area. Minimum of 24 px gives the edge anchor
    // labels ("atom" / "Sun") breathing room from the SVG edges.
    const left = Math.max(24, Math.round(vbWidth * 0.02));
    const right = vbWidth - left;
    const axisY = 85;
    const span = SCALE_LOG_MAX - SCALE_LOG_MIN;
    const toX = (m) => left + ((Math.log10(m) - SCALE_LOG_MIN) / span) * (right - left);

    // Axis
    const axis = document.createElementNS(svgNS, "line");
    axis.setAttribute("x1", left); axis.setAttribute("y1", axisY);
    axis.setAttribute("x2", right); axis.setAttribute("y2", axisY);
    axis.setAttribute("class", "d-scalebar-axis");
    svg.appendChild(axis);

    // Anchors: tick + staggered label (zigzag across two rows so labels
    // never crowd each other).
    const nearY = axisY + 30;
    const farY  = axisY + 54;
    SCALE_ANCHORS.forEach((a, i) => {
      const x = toX(a.m);
      const isFar = i % 2 === 1;

      const tick = document.createElementNS(svgNS, "line");
      tick.setAttribute("x1", x); tick.setAttribute("y1", axisY);
      tick.setAttribute("x2", x); tick.setAttribute("y2", axisY + 10);
      tick.setAttribute("class", "d-scalebar-tick");
      svg.appendChild(tick);

      if (isFar) {
        const stem = document.createElementNS(svgNS, "line");
        stem.setAttribute("x1", x); stem.setAttribute("y1", axisY + 12);
        stem.setAttribute("x2", x); stem.setAttribute("y2", farY - 14);
        stem.setAttribute("class", "d-scalebar-stem");
        svg.appendChild(stem);
      }

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", isFar ? farY : nearY);
      label.setAttribute("class", "d-scalebar-anchorlabel");
      // First / last anchor labels are start / end anchored so they never
      // extend past the SVG left / right edges on narrow containers.
      // Inline style wins over the class's `text-anchor: middle`.
      if (i === 0) label.style.textAnchor = "start";
      else if (i === SCALE_ANCHORS.length - 1) label.style.textAnchor = "end";
      label.textContent = a.text;
      svg.appendChild(label);
    });

    // Pair dots + two-line labels above (descriptor + measurement, same colour).
    const drawPairMark = (m, descText, sizeText, cls) => {
      const x = toX(m);
      const halo = document.createElementNS(svgNS, "circle");
      halo.setAttribute("cx", x); halo.setAttribute("cy", axisY);
      halo.setAttribute("r", 18);
      halo.setAttribute("class", "d-scalebar-halo " + cls);
      svg.appendChild(halo);
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x); dot.setAttribute("cy", axisY);
      dot.setAttribute("r", 11);
      dot.setAttribute("class", "d-scalebar-dot " + cls);
      svg.appendChild(dot);
      // Anchor labels so edge dots don't clip.
      let anchor = "middle";
      if (x < left + 80) anchor = "start";
      else if (x > right - 80) anchor = "end";
      if (descText) {
        const desc = document.createElementNS(svgNS, "text");
        desc.setAttribute("x", x);
        desc.setAttribute("y", axisY - 48);
        desc.setAttribute("text-anchor", anchor);
        desc.setAttribute("class", "d-scalebar-pairdesc " + cls);
        desc.textContent = descText;
        svg.appendChild(desc);
      }
      if (sizeText) {
        const size = document.createElementNS(svgNS, "text");
        size.setAttribute("x", x);
        size.setAttribute("y", axisY - 24);
        size.setAttribute("text-anchor", anchor);
        size.setAttribute("class", "d-scalebar-pairlabel " + cls);
        size.textContent = sizeText;
        svg.appendChild(size);
      }
    };
    drawPairMark(info.startMeters,  info.scaleLabel,  info.size,       "start");
    drawPairMark(info.targetMeters, info.targetLabel, info.targetSize, "target");
  }

  // Fact card — rendered on every phase so the "why is this nano" story
  // is visible from the moment the start title appears until the next pair.
  function appendFactCard(container) {
    const pair = state.pair;
    if (!pair) return;
    const hasAnyContent =
      pair.fact || pair.emoji || pair.image || pair.size || pair.scaleLabel;
    if (!hasAnyContent) return;

    const card = document.createElement("div");
    card.className = "d-factcard";

    const visualCol = document.createElement("div");
    visualCol.className = "d-factcard-visualcol";

    const visual = document.createElement("div");
    visual.className = "d-factcard-visual";
    if (pair.image) {
      const img = document.createElement("img");
      img.className = "d-factcard-img";
      img.src = pair.image;
      img.alt = pair.scaleLabel || pair.start;
      // If the image fails to load, swap in the emoji so the card never
      // shows a broken-image icon on the info screen.
      img.addEventListener("error", () => {
        visual.innerHTML = "";
        if (pair.emoji) {
          const span = document.createElement("span");
          span.className = "d-factcard-emoji";
          span.textContent = pair.emoji;
          visual.appendChild(span);
        }
      });
      visual.appendChild(img);
    } else if (pair.emoji) {
      const span = document.createElement("span");
      span.className = "d-factcard-emoji";
      span.textContent = pair.emoji;
      visual.appendChild(span);
    }
    visualCol.appendChild(visual);

    if (pair.image && pair.imageAuthor) {
      const credit = document.createElement("div");
      credit.className = "d-factcard-credit";
      const license = pair.imageLicense ? " · " + pair.imageLicense : "";
      credit.textContent = pair.imageAuthor + license;
      visualCol.appendChild(credit);
    }

    card.appendChild(visualCol);

    const text = document.createElement("div");
    text.className = "d-factcard-text";

    if (pair.size || pair.scaleLabel) {
      const meta = document.createElement("div");
      meta.className = "d-factcard-meta";
      if (pair.size) {
        const size = document.createElement("div");
        size.className = "d-factcard-size";
        size.textContent = pair.size;
        meta.appendChild(size);
      }
      if (pair.scaleLabel) {
        const label = document.createElement("div");
        label.className = "d-factcard-scalelabel";
        label.textContent = pair.scaleLabel;
        meta.appendChild(label);
      }
      text.appendChild(meta);
    }

    if (pair.fact) {
      const fact = document.createElement("div");
      fact.className = "d-factcard-fact";
      fact.textContent = pair.fact;
      text.appendChild(fact);
    }

    card.appendChild(text);
    container.appendChild(card);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // --- message handling ---
  function applyState(msg) {
    state.phase = msg.phase;
    state.pair = msg.pair;
    state.path = (msg.path || []).slice();
    state.result = msg.result || null;
    state.shortest = (msg.pair && msg.pair.shortest) || [];
    if (msg.phase === PHASES.PLAYING && typeof msg.timeLeft === "number") {
      state.durationMs = msg.durationMs || 30000;
      state.endsAt = performance.now() + msg.timeLeft;
    }
    renderCurrent();
  }

  function renderCurrent() {
    if (state.phase === PHASES.READY) renderReady();
    else if (state.phase === PHASES.COUNTDOWN) renderCountdown(1);
    else if (state.phase === PHASES.PLAYING) renderPlaying();
    else if (state.phase === PHASES.ENDED) renderEnd();
  }

  function onMessage(e) {
    const data = e.data;
    if (!data || data.app !== "nano-wiki-race") return;
    switch (data.type) {
      case "state":
        applyState(data);
        break;
      case "ready":
        // Keep the previous round's reveal up until the next kid actually
        // presses START (which arrives as a `countdown` / `start` message).
        // We still want the stored pair updated so the countdown header
        // shows the right challenge when it fires.
        if (state.phase === PHASES.ENDED) {
          state.pair = data.pair;
          // Don't touch state.path / state.shortest / state.result — those
          // are the reveal that we want to keep showing.
          break;
        }
        state.phase = PHASES.READY;
        state.pair = data.pair;
        state.path = [];
        state.result = null;
        state.shortest = (data.pair && data.pair.shortest) || [];
        renderReady();
        break;
      case "countdown":
        state.phase = PHASES.COUNTDOWN;
        renderCountdown(data.n);
        break;
      case "start":
        state.phase = PHASES.PLAYING;
        state.pair = data.pair;
        state.shortest = (data.pair && data.pair.shortest) || [];
        state.path = [];
        state.durationMs = data.durationMs || 30000;
        state.endsAt = performance.now() + state.durationMs;
        renderPlaying();
        break;
      case "step":
        state.path = (data.path || []).slice();
        if (state.phase === PHASES.PLAYING) {
          renderPathChips(state.path);
        }
        break;
      case "end":
        state.phase = PHASES.ENDED;
        state.result = data.result;
        state.path = (data.path || []).slice();
        state.shortest = (data.shortest || []).slice();
        if (data.pair) state.pair = data.pair;
        renderEnd();
        break;
    }
  }

  function sayHello() {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { app: "nano-wiki-race", type: "hello" },
          "*"
        );
      } catch (_) {}
    }
  }

  // Preview mode: when display.html is loaded with ?preview=<scenario>, skip
  // the live message loop and render a mock end state so the reveal can be
  // iterated on without playing a round through to completion.
  // Scenarios:
  //   win      — kid finishes; kid clicks = ?len=N; shortest = N-2 (so WOW!
  //              only if N <= 2 clicks). Default N=7.
  //   match    — kid matches the shortest path (WOW! branch).
  //   timeout  — kid ran out of time; `your path` ends dashed into target.
  function tryPreviewMode() {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("preview");
    if (!scenario) return false;

    const pair = (window.NWR_PAIRS || [])[0];
    if (!pair) return false;

    const len = Math.max(2, parseInt(params.get("len") || "7", 10));
    // Plausible-sounding intermediate titles so the elide path logic has
    // real-looking content to lay out.
    const stubs = [
      "Reptile", "Southeast Asia", "Jurassic", "Mesozoic", "Climate",
      "Ecosystem", "Biodiversity", "Habitat", "Evolution", "Fossil",
      "Paleogene", "Cretaceous", "Pangaea", "Vertebrate",
    ];
    const middles = [];
    for (let i = 0; i < Math.max(0, len - 2); i++) middles.push(stubs[i % stubs.length]);
    const yourPath = [pair.start].concat(middles).concat([pair.target]);
    const shortest = pair.shortest && pair.shortest.length
      ? pair.shortest.slice()
      : [pair.start, stubs[0], pair.target];

    state.phase = PHASES.ENDED;
    state.pair = pair;
    state.path = scenario === "timeout" ? yourPath.slice(0, -1) : yourPath;
    state.shortest = scenario === "match" ? yourPath : shortest;
    state.result = scenario === "timeout" ? "timeout" : "win";
    renderEnd();
    return true;
  }

  function init() {
    if (tryPreviewMode()) return;
    window.addEventListener("message", onMessage);
    renderReady();
    sayHello();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
