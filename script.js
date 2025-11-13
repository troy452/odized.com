/**
 * Live Content Loader for Gaming Community Hub
 * Includes OGAds Locker Integration
 */

/* ----------------------
   OGAds Locker Setup
   ---------------------- */
const OGADS_LOCKER = "https://odized.com/cl/i/j76wev";  // <-- YOUR LOCKER

/* ----------------------
   CONFIG — optional API keys
   ---------------------- */
const CONFIG = {
  CACHE_TTL_MINUTES: 15,
  FORTNITE_API_KEY: "",
  RAWG_API_KEY: "",
  PANDASCORE_API_KEY: ""
};

/* ----------------------
   Cache Helpers
   ---------------------- */
function cacheSet(key, valueObj) {
  const payload = { ts: Date.now(), data: valueObj };
  localStorage.setItem(key, JSON.stringify(payload));
}

function cacheGet(key, maxAgeMinutes = CONFIG.CACHE_TTL_MINUTES) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    const age = (Date.now() - payload.ts) / 1000 / 60;
    if (age > maxAgeMinutes) return null;
    return payload.data;
  } catch { return null; }
}

/* ----------------------
   DOM Utilities
   ---------------------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") node.className = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

/* ----------------------
   Fetch with timeout
   ---------------------- */
async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/* ----------------------
   DATA SOURCES
   ---------------------- */
const fetchReddit = async (sub, limit = 10) => {
  const r = await fetchWithTimeout(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`);
  const j = await r.json();
  return j.data.children.map(c => c.data);
};

const fetchRobloxBlog = async (limit = 6) => {
  const r = await fetchWithTimeout(`https://blog.roblox.com/wp-json/wp/v2/posts?per_page=${limit}`);
  return r.json();
};

const fetchMemes = async (limit = 12) => {
  const subs = ["gamingmemes", "dankmemes", "memes"];
  const promises = subs.map(s => fetchReddit(s, limit / subs.length).catch(_ => []));
  const results = await Promise.all(promises);
  return results.flat();
};

const fetchRandomProfiles = async (count = 10) => {
  const r = await fetchWithTimeout(`https://randomuser.me/api/?results=${count}&inc=name,picture,login`);
  const j = await r.json();
  return j.results;
};

const fetchTrendingGames = async (limit = 8) => {
  if (CONFIG.RAWG_API_KEY) {
    const r = await fetchWithTimeout(
      `https://api.rawg.io/api/games/lists/popular?key=${CONFIG.RAWG_API_KEY}&page_size=${limit}`
    );
    const j = await r.json();
    return j.results;
  }
  return fetchReddit("gaming", limit);
};

/* ----------------------
   CACHED Loaders
   ---------------------- */
async function loadWithCache(key, loader) {
  const c = cacheGet(key);
  if (c) return c;
  const fresh = await loader();
  cacheSet(key, fresh);
  return fresh;
}

/* ----------------------
   RENDERERS
   ---------------------- */
async function renderNewsPage() {
  const container = document.querySelector(".news-list");
  if (!container) return;

  container.innerHTML = "<div>Loading news…</div>";
  try {
    const [roblox, reddit] = await Promise.all([
      loadWithCache("roblox_blog", () => fetchRobloxBlog(6)),
      loadWithCache("reddit_gaming", () => fetchReddit("gaming", 8)),
    ]);

    container.innerHTML = "";

    roblox.forEach(p => {
      container.appendChild(
        el("div", { class: "news-item" }, [
          el("h2", {}, [p.title.rendered]),
          el("p", {}, [p.excerpt.rendered.replace(/<[^>]+>/g, "").slice(0, 200) + "…"]),
          el("div", { class: "date" }, [formatDate(p.date)])
        ])
      );
    });

    reddit.forEach(p => {
      container.appendChild(
        el("div", { class: "news-item" }, [
          el("h2", {}, [p.title]),
          el("p", {}, [p.selftext.slice(0, 200) + "…"]),
          el("a", { href: "https://reddit.com" + p.permalink, target: "_blank" }, ["Read on Reddit"]),
          el("div", { class: "date" }, [formatDate(new Date(p.created_utc * 1000))])
        ])
      );
    });
  } catch {
    container.innerHTML = "<div class='news-error'>Failed to load news.</div>";
  }
}

async function renderMemesPage() {
  const container = document.querySelector(".meme-grid");
  if (!container) return;

  container.innerHTML = "<div>Loading memes…</div>";

  try {
    const memes = await loadWithCache("memes", () => fetchMemes(12));
    container.innerHTML = "";

    memes.forEach(m => {
      const img = m.url_overridden_by_dest || m.thumbnail;
      const card = el("div", { class: "meme-card" }, [
        img && img.startsWith("http") ? el("img", { src: img }) : "",
        el("p", {}, [m.title])
      ]);
      container.appendChild(card);
    });
  } catch {
    container.innerHTML = "<div>Could not load memes.</div>";
  }
}

async function renderForumsPage() {
  const c = document.querySelector(".forum-list");
  if (!c) return;

  const cats = [
    { t: "Roblox Discussions", d: "Events, tips, ideas." },
    { t: "Fortnite Battle Talk", d: "Clips, updates, strategies." },
    { t: "Mobile Gaming", d: "PUBG Mobile, CODM, Free Fire." },
    { t: "General Gaming", d: "All platforms welcome." }
  ];

  c.innerHTML = "";
  cats.forEach(cat => {
    c.appendChild(
      el("div", { class: "forum-item" }, [
        el("h2", {}, [cat.t]),
        el("p", {}, [cat.d]),
        el("span", { class: "date" }, [`${Math.floor(Math.random()*2000)+50} posts`]),
        el("a", { class: "btn", href: "#" }, ["Enter"])
      ])
    );
  });
}

async function renderProfilesPage() {
  const container = document.querySelector(".profile-grid");
  if (!container) return;

  container.innerHTML = "<div>Loading profiles…</div>";

  try {
    const profiles = await loadWithCache("profiles", () => fetchRandomProfiles(12));
    container.innerHTML = "";

    profiles.forEach(p => {
      container.appendChild(
        el("div", { class: "profile-card" }, [
          el("img", { src: p.picture.large }),
          el("h2", {}, [`${p.name.first} ${p.name.last}`]),
          el("p", {}, [`Gamer Tag: ${p.login.username}`]),
          el("span", { class: "rank" }, [`Rank #${Math.floor(Math.random()*200)+1}`])
        ])
      );
    });
  } catch {
    container.innerHTML = "<div>Failed to load profiles.</div>";
  }
}

async function renderGiveawaysPage() {
  const container = document.querySelector(".giveaway-grid");
  if (!container) return;

  const giveaways = [
    { t: "$20 Roblox Gift Card", d: "Winner chosen monthly." },
    { t: "1,000 V-Bucks", d: "Skins, emotes and more." },
    { t: "Gaming Headset", d: "Perfect for streaming." }
  ];

  container.innerHTML = "";

  giveaways.forEach(g => {
    container.appendChild(
      el("div", { class: "giveaway-card" }, [
        el("h2", {}, [g.t]),
        el("p", {}, [g.d]),
        el("button", { class: "btn giveaway-btn" }, ["Enter Giveaway"])
      ])
    );
  });
}

/* ----------------------
   Trending Games (Home)
   ---------------------- */
async function renderTrendingGamesSection() {
  const grid = document.querySelector(".grid");
  if (!grid) return;

  try {
    const games = await loadWithCache("trending", () => fetchTrendingGames(6));

    const card = el("a", { class: "card", href: "news.html" }, [
      el("h2", {}, ["🔥 Trending Games"]),
      ...games.slice(0, 5).map(g =>
        el("div", { class: "muted" }, [g.name || "(Unnamed game)"])
      )
    ]);

    grid.insertBefore(card, grid.firstChild);
  } catch {}
}

/* ----------------------
   Apply OGAds to buttons
   ---------------------- */
function enableOGAdsRedirect() {
  setTimeout(() => {
    document.querySelectorAll(".giveaway-btn, .giveaway-card .btn").forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        window.open(OGADS_LOCKER, "_blank");
      };
    });
  }, 1000);
}

/* ----------------------
   Boot loader
   ---------------------- */
async function boot() {
  // Theme
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    const saved = localStorage.getItem("siteTheme") || "";
    if (saved) document.documentElement.classList.add(saved);
    themeSelect.value = saved;
    themeSelect.onchange = () => {
      document.documentElement.classList.remove("theme-roblox","theme-fortnite");
      if (themeSelect.value) document.documentElement.classList.add(themeSelect.value);
      localStorage.setItem("siteTheme", themeSelect.value);
    };
  }

  // Mobile nav
  const burger = document.getElementById("hamburger");
  const nav = document.getElementById("mainNav");
  if (burger && nav) {
    burger.onclick = () => {
      nav.style.display = nav.style.display === "flex" ? "none" : "flex";
    };
  }

  // Page Renderers
  if (document.querySelector(".news-list")) renderNewsPage();
  if (document.querySelector(".meme-grid")) renderMemesPage();
  if (document.querySelector(".forum-list")) renderForumsPage();
  if (document.querySelector(".profile-grid")) renderProfilesPage();
  if (document.querySelector(".giveaway-grid")) renderGiveawaysPage();
  if (document.querySelector(".grid")) renderTrendingGamesSection();

  // OGAds Activation
  enableOGAdsRedirect();
}

document.addEventListener("DOMContentLoaded", boot);
