// Nano Wiki Race — Wikipedia fetch, clean, and title normalization.
// Exposes `window.wiki` with { fetchArticle, cleanHTML, normalizeTitle }.
(function () {
  const cache = new Map();
  const pending = new Map();

  // Trim/decode and uppercase first letter. Match MediaWiki's title canonical form
  // closely enough for win detection — not a full canonicalization.
  function normalizeTitle(title) {
    if (!title) return "";
    let t = String(title);
    try {
      t = decodeURIComponent(t);
    } catch (_) {
      // ignore malformed URI escapes
    }
    t = t.split("#")[0];
    t = t.replace(/_/g, " ").trim();
    if (t.length === 0) return "";
    return t[0].toUpperCase() + t.slice(1);
  }

  function wikiURL(title) {
    const host = (window.NWR_CONFIG && window.NWR_CONFIG.WIKI_HOST) || "en.wikipedia.org";
    const params = new URLSearchParams({
      action: "parse",
      page: title,
      prop: "text",
      redirects: "1",
      disableeditsection: "1",
      disabletoc: "1",
      formatversion: "2",
      format: "json",
      origin: "*",
    });
    return "https://" + host + "/w/api.php?" + params.toString();
  }

  // Fetch an article. Returns { title, html } where title is the canonical title.
  async function fetchArticle(title) {
    const key = normalizeTitle(title);
    if (cache.has(key)) return cache.get(key);
    if (pending.has(key)) return pending.get(key);

    const p = (async () => {
      const res = await fetch(wikiURL(title));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error.info || "Wikipedia error");
      const parse = data.parse;
      if (!parse || !parse.text) throw new Error("No article body");
      const result = { title: parse.title, html: parse.text };
      cache.set(normalizeTitle(parse.title), result);
      // Also cache under the requested title in case of redirects.
      cache.set(key, result);
      return result;
    })();

    pending.set(key, p);
    try {
      return await p;
    } finally {
      pending.delete(key);
    }
  }

  // Clean raw Wikipedia HTML for display. Returns an HTMLElement (a <div>).
  function cleanHTML(html) {
    // Fix protocol-relative URLs before parsing so images don't resolve to
    // file://upload.wikimedia.org/... when running from a file:// page.
    let fixed = html;
    fixed = fixed.replace(/(\s(?:src|poster)=")\/\//g, '$1https://');
    fixed = fixed.replace(/(\ssrcset=")([^"]+)(")/g, function (_m, pre, val, post) {
      return pre + val.replace(/(^|,\s*)\/\//g, "$1https://") + post;
    });

    // DOMParser avoids triggering resource loads during parsing.
    const doc = new DOMParser().parseFromString(
      "<!DOCTYPE html><html><body>" + fixed + "</body></html>",
      "text/html"
    );
    const container = document.createElement("div");
    container.className = "wiki-article";
    // Move body children into container.
    while (doc.body.firstChild) container.appendChild(doc.body.firstChild);

    // Strip clutter.
    const removeSelectors = [
      ".mw-editsection",
      ".reference",
      "sup.reference",
      ".navbox",
      ".vertical-navbox",
      ".sidebar",
      ".ambox",
      ".mbox-small",
      ".metadata",
      ".sistersitebox",
      ".references",
      ".refbegin",
      ".reflist",
      ".mw-cite-backlink",
      ".shortdescription",
      ".noprint",
      ".hatnote",
      "style",
      "script",
      "link",
    ];
    for (const sel of removeSelectors) {
      container.querySelectorAll(sel).forEach((el) => el.remove());
    }

    // Chop everything from "References" / "External links" / ... onward.
    const stopHeadings = /^(references|external links|further reading|notes|bibliography|citations|sources|see also)$/i;
    const headings = Array.from(container.querySelectorAll("h2"));
    for (const h of headings) {
      // The heading text is wrapped in a span.mw-headline on older HTML, or is
      // the direct text on newer HTML.
      const span = h.querySelector(".mw-headline");
      const text = (span ? span.textContent : h.textContent).trim();
      if (stopHeadings.test(text)) {
        let el = h;
        while (el) {
          const next = el.nextSibling;
          el.remove();
          el = next;
        }
        break;
      }
    }

    return container;
  }

  // Namespaces whose /wiki/ links should be ignored.
  const SKIP_NAMESPACES = new Set([
    "File", "Image", "Category", "Help", "Special", "Wikipedia", "WP",
    "Template", "Template_talk", "Talk", "User", "User_talk", "Portal",
    "Book", "Draft", "MediaWiki", "Module",
  ]);

  // Given an <a> element, return the Wikipedia title it points to, or null if
  // the link should be ignored (external, red link, namespaced, anchor-only).
  function linkTargetTitle(a) {
    if (!a) return null;
    if (a.classList.contains("new")) return null; // red link
    const href = a.getAttribute("href");
    if (!href) return null;
    if (!href.startsWith("/wiki/")) return null;
    let rest = href.slice(6);
    rest = rest.split("#")[0];
    rest = rest.split("?")[0];
    if (!rest) return null;
    let title;
    try {
      title = decodeURIComponent(rest);
    } catch (_) {
      title = rest;
    }
    title = title.replace(/_/g, " ");
    const colon = title.indexOf(":");
    if (colon > 0) {
      const ns = title.slice(0, colon).replace(/ /g, "_");
      if (SKIP_NAMESPACES.has(ns)) return null;
    }
    return title;
  }

  window.wiki = { fetchArticle, cleanHTML, normalizeTitle, linkTargetTitle };
})();
