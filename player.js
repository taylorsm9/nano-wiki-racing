// Nano Wiki Race — player (kid's screen) game loop.
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
    startedAt: 0,
    endsAt: 0,
    displayWindow: null,
    pairQueue: [],
    result: null,
    endTimer: null,
    countdownTimer: null,
  };

  // --- element shortcuts ---
  const el = {
    ready: document.getElementById("ready-screen"),
    countdown: document.getElementById("countdown-screen"),
    playing: document.getElementById("playing-screen"),
    ended: document.getElementById("end-screen"),
    startTitle: document.getElementById("start-title"),
    targetTitle: document.getElementById("target-title"),
    startBtn: document.getElementById("start-btn"),
    openDisplayBtn: document.getElementById("open-display-btn"),
    countdownNumber: document.getElementById("countdown-number"),
    playingTarget: document.getElementById("playing-target"),
    playingTimer: document.getElementById("playing-timer"),
    article: document.getElementById("article"),
    endBig: document.getElementById("end-big"),
    toast: document.getElementById("toast"),
  };

  // --- helpers ---
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function refillQueue() {
    const pairs = (window.NWR_PAIRS || []).slice();
    if (pairs.length === 0) {
      alert("No pairs defined. Edit pairs.js to add some.");
      return;
    }
    state.pairQueue = shuffle(pairs);
  }

  function showScreen(name) {
    el.ready.hidden = name !== "ready";
    el.countdown.hidden = name !== "countdown";
    el.playing.hidden = name !== "playing";
    el.ended.hidden = name !== "ended";
  }

  function send(msg) {
    if (!state.displayWindow || state.displayWindow.closed) return;
    try {
      state.displayWindow.postMessage(
        Object.assign({ app: "nano-wiki-race" }, msg),
        "*"
      );
    } catch (_) {
      // ignore
    }
  }

  function fullState() {
    const now = performance.now();
    const timeLeft =
      state.phase === PHASES.PLAYING ? Math.max(0, state.endsAt - now) : 0;
    return {
      type: "state",
      phase: state.phase,
      pair: state.pair,
      path: state.path.slice(),
      timeLeft,
      durationMs: (window.NWR_CONFIG.ROUND_SECONDS || 30) * 1000,
      result: state.result,
    };
  }

  function showToast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove("show"), 1500);
  }

  // --- display window ---
  function openDisplay() {
    if (state.displayWindow && !state.displayWindow.closed) {
      state.displayWindow.focus();
      return;
    }
    state.displayWindow = window.open("display.html", "nwr-display");
    if (!state.displayWindow) {
      alert("Pop-up blocked. Allow pop-ups for this page, then press D.");
    }
  }

  // --- phase transitions ---
  function nextPair() {
    if (state.pairQueue.length === 0) refillQueue();
    state.pair = state.pairQueue.shift();
    state.path = [];
    state.result = null;
    state.phase = PHASES.READY;
    el.startTitle.textContent = state.pair.start;
    el.targetTitle.textContent = state.pair.target;
    showScreen("ready");
    send({ type: "ready", pair: state.pair });
    // Warm the article cache for a snappy countdown→play transition.
    wiki.fetchArticle(state.pair.start).catch(() => {});
  }

  function startRound() {
    if (state.phase !== PHASES.READY) return;
    state.phase = PHASES.COUNTDOWN;
    showScreen("countdown");
    let n = window.NWR_CONFIG.COUNTDOWN_SECONDS || 3;
    el.countdownNumber.textContent = n;
    send({ type: "countdown", n });
    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        el.countdownNumber.textContent = n;
        send({ type: "countdown", n });
      } else {
        clearInterval(state.countdownTimer);
        beginPlay();
      }
    }, 1000);
  }

  function beginPlay() {
    state.phase = PHASES.PLAYING;
    state.path = [];
    state.startedAt = performance.now();
    const durationMs = (window.NWR_CONFIG.ROUND_SECONDS || 30) * 1000;
    state.endsAt = state.startedAt + durationMs;
    el.playingTarget.textContent = state.pair.target;
    showScreen("playing");
    send({ type: "start", pair: state.pair, durationMs });
    renderLoading();
    loadArticle(state.pair.start, true);
    tick();
  }

  function tick() {
    if (state.phase !== PHASES.PLAYING) return;
    const now = performance.now();
    const left = Math.max(0, state.endsAt - now);
    const secs = Math.ceil(left / 1000);
    el.playingTimer.textContent = secs;
    if (secs <= 10) el.playingTimer.classList.add("warn");
    else el.playingTimer.classList.remove("warn");
    if (left <= 0) {
      endRound("timeout");
      return;
    }
    requestAnimationFrame(tick);
  }

  function endRound(result) {
    if (state.phase !== PHASES.PLAYING) return;
    state.phase = PHASES.ENDED;
    state.result = result;
    const bigText = result === "win" ? "You did it! 🎉" : "Time's up!";
    el.endBig.textContent = bigText;
    el.endBig.className = "big " + result;
    showScreen("ended");
    send({
      type: "end",
      result,
      pair: state.pair,
      path: state.path.slice(),
      shortest: state.pair.shortest || [],
    });
    clearTimeout(state.endTimer);
    state.endTimer = setTimeout(
      nextPair,
      (window.NWR_CONFIG.END_SCREEN_SECONDS || 5) * 1000
    );
  }

  // --- article rendering ---
  function renderLoading() {
    el.article.innerHTML = '<div class="loading">Loading…</div>';
  }

  function renderArticle(result) {
    const cleaned = wiki.cleanHTML(result.html);
    const h1 = document.createElement("h1");
    h1.textContent = result.title;
    cleaned.insertBefore(h1, cleaned.firstChild);
    el.article.innerHTML = "";
    el.article.appendChild(cleaned);
    el.article.scrollTop = 0;
  }

  async function loadArticle(title, isFirst) {
    const myPhaseStart = state.phase;
    try {
      renderLoading();
      const result = await wiki.fetchArticle(title);
      if (state.phase !== myPhaseStart) return; // phase changed while loading
      if (state.phase !== PHASES.PLAYING) return;
      renderArticle(result);

      const last = state.path[state.path.length - 1];
      if (last !== result.title) {
        state.path.push(result.title);
        send({ type: "step", title: result.title, path: state.path.slice() });
      }

      // Win check — compare resolved title to the target.
      if (
        wiki.normalizeTitle(result.title) ===
        wiki.normalizeTitle(state.pair.target)
      ) {
        endRound("win");
      }
    } catch (e) {
      if (state.phase !== PHASES.PLAYING) return;
      if (isFirst) {
        // Give the kid *something* so the round can still unfold.
        el.article.innerHTML =
          '<div class="loading">Couldn\'t load the start article. The timer is still running — try pressing N to skip.</div>';
      } else {
        showToast("Oops, try another link!");
      }
    }
  }

  // --- link interception ---
  function onArticleClick(e) {
    if (state.phase !== PHASES.PLAYING) return;
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    const title = wiki.linkTargetTitle(a);
    if (!title) return;
    loadArticle(title, false);
  }

  // --- key bindings ---
  function onKey(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const k = e.key;
    if (k === " " || k === "Enter") {
      if (state.phase === PHASES.READY) {
        e.preventDefault();
        startRound();
      }
    } else if (k === "n" || k === "N") {
      skipPair();
    } else if (k === "d" || k === "D") {
      openDisplay();
    }
  }

  function skipPair() {
    clearInterval(state.countdownTimer);
    clearTimeout(state.endTimer);
    if (state.phase === PHASES.PLAYING) {
      // Treat skip during play as a soft timeout.
      state.phase = PHASES.READY; // short-circuit endRound reveal flow
    }
    nextPair();
  }

  // --- display handshake ---
  function onMessage(e) {
    const data = e.data;
    if (!data || data.app !== "nano-wiki-race") return;
    if (data.type === "hello") {
      // Make sure we reply to the window that announced itself.
      if (e.source) state.displayWindow = e.source;
      try {
        (e.source || state.displayWindow).postMessage(
          Object.assign({ app: "nano-wiki-race" }, fullState()),
          "*"
        );
      } catch (_) {}
    }
  }

  // --- init ---
  function init() {
    refillQueue();
    el.startBtn.addEventListener("click", startRound);
    el.openDisplayBtn.addEventListener("click", openDisplay);
    el.article.addEventListener("click", onArticleClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    nextPair();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
