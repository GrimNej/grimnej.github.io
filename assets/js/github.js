// Live repository list for "The rest of the pile". Loads public repositories
// from the GitHub API in the visitor's browser (cached for 30 minutes per
// session) and falls back to data/github.json when the API is unreachable or
// rate limited, so the list never renders empty.

const USER = "GrimNej";
const API = "https://api.github.com";
const CACHE_KEY = "gh:v2";
const CACHE_TTL = 30 * 60 * 1000;
const PAGE = 8;

const FEATURED = new Set(["GhostAudience", "Project-Consera", "OrthoVerba", "Ripple", "LM-Comment", "CaptionMan", "Open-Proto", "Editing-Buddy", "Read-Anchor"]);

// Only repositories whose README opens with a banner image make the archive.
// These were checked by hand; anything pushed later is checked live (see hasBanner).
const SHOWN = new Set([
  "Portfolio-Design-Skill", "Project-Consera", "GhostAudience", "LM-Comment", "Ripple", "OrthoVerba",
  "CaptionMan", "Peek-A-Comment", "Open-Proto", "Project-OrthoVerba", "Read-Anchor", "Editing-Buddy",
]);
const HIDDEN = new Set([
  USER, // the profile README repository
  "grimnej.github.io", "GOSIM_SHENZHEN_2026", "Conseraa", "ripple-source-lab", "LexiPulse", "Idea-5-Architecture",
  "MoFA-Effect-Architecture", "Internal-Stuff", "Internal-Project-1", "videolizer", "learning_git_advanced",
  "GrimNej-Porfolio", "LLM-Integrated-MCQ-Quiz-Game", "Medical-ChatBot-with-Dual-AI-Pipeline",
  "ServerMind-Semantic-Search-Bot", "Adaptive-Persona-Discord-Ai-Bot", "Ginej-Diken-Collaboration-", "Generative-Ai", "Clip-Forge",
]);

const LANG_COLORS = {
  Python: "#4f8fd1",
  TypeScript: "#3f7fd6",
  JavaScript: "#f1e05a",
  Kotlin: "#a97bff",
  Rust: "#dea584",
  HTML: "#e96b46",
  CSS: "#8a5cf6",
  "Jupyter Notebook": "#f08a3c",
  Java: "#d08a3a",
  Swift: "#f05138",
  Shell: "#89e051",
};

// Taglines from each project's README, used while the GitHub description is empty.
const FALLBACK_DESCRIPTIONS = {
  GhostAudience: "Meet your audience before you present, publish, or perform. A simulated audience reads your text section by section.",
  "Project-Consera": "Silence-first project intelligence that explains only the technology shifts worth acting on.",
  Ripple: "Change intelligence: trace source changes, map their impact, and apply human-approved repairs with proof.",
  OrthoVerba: "A private, browser-based reader that follows your voice as you read a script aloud.",
};

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.at < CACHE_TTL ? c.repos : null;
  } catch {
    return null;
  }
}

function writeCache(repos) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    /* storage unavailable */
  }
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

function normaliseRepo(r) {
  return {
    name: r.name,
    description: r.description || FALLBACK_DESCRIPTIONS[r.name] || null,
    url: r.html_url ?? r.url,
    language: r.language,
    fork: r.fork,
    pushedAt: r.pushed_at ?? r.pushedAt,
    topics: r.topics ?? [],
  };
}

async function loadRepos() {
  const cached = readCache();
  if (cached) return { repos: cached, source: "live" };
  try {
    const live = await getJSON(`${API}/users/${USER}/repos?per_page=100&sort=pushed`, { Accept: "application/vnd.github+json" });
    const repos = live.map(normaliseRepo);
    writeCache(repos);
    return { repos, source: "live" };
  } catch {
    try {
      const snap = await getJSON("data/github.json");
      return { repos: snap.repos.map(normaliseRepo), source: "snapshot" };
    } catch {
      return { repos: [], source: "none" };
    }
  }
}

// A banner is a non-badge image that comes before the README's first line of prose.
const IMG = /!\[[^\]]*\]\(\s*<?([^)>]+?)>?\s*\)|<img[^>]*src=["']([^"']+)/gi;
const BADGE = /shields\.io|badge|badgen|travis-ci|codecov|\/workflows\/|readme-typing-svg|skillicons|komarev|github-readme-stats|forthebadge/i;

async function hasBanner(name) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${USER}/${name}/HEAD/README.md`, { signal: ctrl.signal });
    if (!res.ok) return false;
    for (const line of (await res.text()).split("\n")) {
      const s = line.trim();
      if (!s) continue;
      const imgs = [...s.matchAll(IMG)].map((m) => m[1] || m[2]);
      if (imgs.some((src) => !BADGE.test(src))) return true;
      if (imgs.length || /^(#|<|---)/.test(s)) continue;
      return false;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Applies the banner rule: known repositories by list, new ones by reading their README.
async function curate(repos) {
  const unknown = repos.filter((r) => !r.fork && !SHOWN.has(r.name) && !HIDDEN.has(r.name));
  const verdicts = await Promise.all(unknown.map((r) => hasBanner(r.name)));
  const extra = new Set(unknown.filter((_, i) => !verdicts[i]).map((r) => r.name));
  return repos.filter((r) => !HIDDEN.has(r.name) && !extra.has(r.name));
}

const rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
const fmtDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs || unit === "minute") {
      const v = Math.round(diff / secs);
      return rtf ? rtf.format(v, unit) : `${Math.abs(v)} ${unit}s ago`;
    }
  }
  return "";
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

function icon(id, cls = "icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `assets/img/icons.svg#i-${id}`);
  svg.append(use);
  return svg;
}

function initArchive(root, repos, source) {
  const list = root.querySelector("[data-archive-list]");
  const search = root.querySelector("[data-archive-search]");
  const filters = root.querySelector("[data-archive-filters]");
  const more = root.querySelector("[data-archive-more]");
  const forks = root.querySelector("[data-archive-forks]");
  const status = root.querySelector("[data-archive-status]");

  // Documented repositories first, then by most recent push.
  const all = repos
    .slice()
    .sort((a, b) => Number(Boolean(b.description)) - Number(Boolean(a.description)) || new Date(b.pushedAt) - new Date(a.pushedAt));
  let lang = "All";
  let query = "";
  let expanded = false;

  if (status && source === "snapshot") {
    status.textContent = "GitHub isn't answering right now, so this is a saved copy of my repositories.";
    root.querySelector(".archive__note .live__dot")?.classList.add("is-stale");
  }

  const langs = {};
  all.filter((r) => !r.fork).forEach((r) => {
    if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  });
  const top = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([l]) => l);

  filters.replaceChildren(
    ...["All", ...top].map((l) => el("button", { type: "button", "aria-pressed": l === lang ? "true" : "false", "data-lang": l, text: l }))
  );

  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (!b) return;
    lang = b.dataset.lang;
    filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  });
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    render();
  });
  forks.addEventListener("change", render);
  more.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  function row(r) {
    const isNew = Date.now() - new Date(r.pushedAt).getTime() < 21 * 86400000;
    const name = el("span", { class: "repo__name" }, [r.name.replace(/-/g, "‑")]);
    if (FEATURED.has(r.name)) name.append(el("span", { class: "repo__badge", text: "featured" }));
    if (r.fork) name.append(el("span", { class: "repo__badge", text: "fork" }));
    if (isNew && !r.fork) name.append(el("span", { class: "repo__badge repo__badge--new", text: "fresh" }));
    const desc = el("span", { class: r.description ? "repo__desc" : "repo__desc repo__desc--empty", text: r.description || "No description yet." });
    const langEl = el("span", { class: "repo__lang", style: r.language ? `--lang: ${LANG_COLORS[r.language] || "#8c92a7"}` : null }, [
      el("i", { "aria-hidden": "true" }),
      r.language || "Mixed",
    ]);
    const date = el("span", { class: "repo__date", title: `Last updated ${fmtDate.format(new Date(r.pushedAt))}`, text: timeAgo(r.pushedAt) });
    const a = el("a", { href: r.url, target: "_blank", rel: "noopener", "data-cursor": "Open repo" }, [name, desc, langEl, date, icon("arrow-ur", "icon repo__go")]);
    return el("li", { class: "repo" }, [a]);
  }

  function render() {
    const matches = all.filter((r) => {
      if (!forks.checked && r.fork) return false;
      if (lang !== "All" && r.language !== lang) return false;
      if (!query) return true;
      return [r.name, r.description, r.language, ...(r.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
    const visible = expanded || query ? matches : matches.slice(0, PAGE);
    list.replaceChildren(...(matches.length ? visible.map(row) : [el("li", { class: "repos__empty", text: "Nothing matches that. Try another filter." })]));
    more.hidden = Boolean(query) || matches.length <= PAGE;
    more.textContent = expanded ? "Show fewer" : `Show all ${matches.length} repositories`;
  }

  render();
}

export async function initGitHub() {
  const archive = document.querySelector("[data-archive]");
  if (!archive) return;
  const list = archive.querySelector("[data-archive-list]");
  list.replaceChildren(...Array.from({ length: 5 }, () => el("li", { class: "repo__skeleton", "aria-hidden": "true" })));

  const loaded = await loadRepos();
  const repos = await curate(loaded.repos);
  if (repos.length) initArchive(archive, repos, loaded.source);
  else {
    list.replaceChildren(
      el("li", { class: "repos__empty" }, [
        "GitHub couldn't be reached right now. ",
        el("a", { class: "arrow-link", href: `https://github.com/${USER}?tab=repositories`, target: "_blank", rel: "noopener", text: "Browse my repositories on GitHub" }),
      ])
    );
  }
}
