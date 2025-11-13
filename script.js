/**
 * Gaming Hub – Full Script
 * Live content loader + OGAds locker integration
 * Works on: https://odized.com (custom domain)
 */

/* --------------------------------------
   CONFIG
-------------------------------------- */
const CONFIG = {
  CACHE_TTL_MINUTES: 15,
  RAWG_API_KEY: "",
  FORTNITE_API_KEY: "",
  PANDASCORE_API_KEY: ""
};

// OGADS CONTENT LOCKER (ABSOLUTE URL)
const OGADS_LOCKER = "https://odized.com/cl/i/j76wev";

/* --------------------------------------
   CACHE HELPERS
-------------------------------------- */
function cacheSet(key, valueObj) {
  const payload = { ts: Date.now(), data: valueObj };
  localStorage.setItem(key, JSON.stringify(payload));
}

function cacheGet(key, maxAgeMinutes = CONFIG.CACHE_TTL_MINUTES) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    const age = (Date.now() - payload.ts) / 60000;

    if (age > maxAgeMinutes) {
      localStorage.removeItem(key);
      return null;
    }
    return payload.data;
  } catch (e) {
    return null;
  }
}

/* --------------------------------------
   DOM UTILS
-------------------------------------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") node.className = attrs[k];
    else if (k === "html") node.innerHTML = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* --------------------------------------
   NETWORK HELPERS
-------------------------------------- */
async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  const res = await fetch(url, { ...opts, signal: controller.signal });
  clearTimeout(t);
  if (!res.ok) throw new Error("HTTP " + res.status);

  return res;
}

async function fetchReddit(subreddit, limit = 8) {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
  const res = await fetchWithTimeout(url);
  const json = await res.json();
  return json.data.children.map(c => c.data);
}

async function fetchRobloxBlog(limit = 6) {
  const url = `https://blog.roblox.com/wp-json/wp/v2/posts?per_page=${limit}`;
  const r = await fetchWithTimeout(url);
  return r.json();
}

async function fetchTrendingGames(limit = 6) {
  if (CONFIG.RAWG_API_KEY) {
    const url = `https://api.rawg.io/api/games/lists/popular?key=${CONFIG.RAWG_API_KEY}&page_size=${limit}`;
    const r = await fetchWithTimeout(url);
    const j = await r.json();
    return j.results;
  }

  // Reddit fallback
  const posts = await fetchReddit("gaming", limit);
  return posts.map(p => ({ name: p.title }));
}

async function fetchMemes(limit = 12) {
  const subs = ["gamingmemes", "dankmemes", "memes"];
  const lists = await Promise.all(subs.map(s => fetchReddit(s, limit / 3).catch(() => [])));
  return lists.flat();
}

async function fetchRandomProfiles(count = 8) {
  const url = `https://randomuser.me/api/?results=${count}&inc=name,picture,login`;
  const r = await fetchWithTimeout(url);
  return (await r.json()).results;
}

/* --------------------------------------
   CACHE WRAPPER
-------------------------------------- */
async function loadWithCache(key, loader, ttl = CONFIG.CACHE_TTL_MINUTES) {
  const cached = cacheGet(key, ttl);
  if (cached) return cached;

  try {
    const fresh = await loader();
    cacheSet(key, fresh);
    return fresh;
  } catch (e) {
    const fallback = cacheGet(key, ttl * 4);
    if (fallback) return fallback;
    throw e;
  }
}

/* --------------------------------------
   PAGE RENDERERS
-------------------------------------- */
async function renderNewsPage() {
  const box = document.querySelector(".news-list");
  if (!box) return;

  box.innerHTML = "Loading news...";

  try {
    const [roblox, gaming] = await Promise.all([
      loadWithCache("roblox_blog", () => fetchRobloxBlog(8)),
      loadWithCache("gaming_news", () => fetchReddit("gaming", 10))
    ]);

    box.innerHTML = "";

    roblox.forEach(p => {
      box.appendChild(el("div", { class: "news-item" }, [
        el("h2", {}, [p.title.rendered]),
        el("p", {}, [(p.excerpt.rendered || "").replace(/<[^>]+>/g, "").slice(0, 220) + "..."]),
        el("div", { class: "date" }, [formatDate(p.date)])
      ]));
    });

    gaming.slice(0, 6).forEach(p => {
      box.appendChild(el("div", { class: "news-item" }, [
        el("h2", {}, [p.title]),
        el("p", {}, [(p.selftext || "").slice(0, 220) + "..."]),
        el("a", { href: "https://reddit.com" + p.permalink, target: "_blank" }, ["Read on Reddit"]),
        el("div", { class: "date" }, [formatDate(new Date(p.created_utc * 1000))])
      ]));
    });

  } catch {
    box.innerHTML = "Failed to load news.";
  }
}

async function renderMemesPage() {
  const box = document.querySelector(".meme-grid");
  if (!box) return;

  box.innerHTML = "Loading memes...";

  try {
    const memes = await loadWithCache("memes", () => fetchMemes(12));
    box.innerHTML = "";

    memes.forEach(m => {
      const img = m.url_overridden_by_dest || m.thumbnail;
      box.appendChild(el("div", { class: "meme-card" }, [
        img ? el("img", { src: img, alt: m.title }) : "",
        el("p", {}, [m.title])
      ]));
    });

  } catch {
    box.innerHTML = "Failed to load memes.";
  }
}

async function renderProfilesPage() {
  const box = document.querySelector(".profile-grid");
  if (!box) return;

  box.innerHTML = "Loading profiles...";

  const prof = await loadWithCache("profiles", () => fetchRandomProfiles(12));

  box.innerHTML = "";
  prof.forEach(p => {
    box.appendChild(el("div", { class: "profile-card" }, [
      el("img", { src: p.picture.large }),
      el("h2", {}, [`${p.name.first} ${p.name.last}`]),
      el("p", {}, [`Gamer Tag: ${p.login.username}`]),
      el("span", { class: "rank" }, [`Rank #${Math.floor(Math.random() * 200)}`])
    ]));
  });
}

async function renderForumsPage() {
  const box = document.querySelector(".forum-list");
  if (!box) return;

  const cats = [
    { title: "Roblox Discussions", desc: "Avatar ideas, builders, events..." },
    { title: "Fortnite Battle Talk", desc: "Drops, skins, updates..." },
    { title: "Mobile Games", desc: "PUBG Mobile, Free Fire, CODM..." },
    { title: "General Gaming", desc: "Talk about any game!" }
  ];

  cats.forEach(c => {
    box.appendChild(el("div", { class: "forum-item" }, [
      el("h2", {}, [c.title]),
      el("p", {}, [c.desc]),
      el("div", { class: "meta" }, [
        `${Math.floor(Math.random() * 1500)} posts • ${Math.floor(Math.random() * 150)} active`
      ]),
      el("a", { class: "btn", href: "#" }, ["Enter"])
    ]));
  });
}

async function renderGiveawaysPage() {
  const box = document.querySelector(".giveaway-grid");
  if (!box) return;

  const items = [
    { title: "$20 Roblox Gift Card", desc: "Win a Roblox digital card." },
    { title: "1,000 V-Bucks", desc: "Fortnite V-Bucks for skins and emotes." },
    { title: "Gaming Headset", desc: "High-quality headset for gaming." },
    { title: "Steam Gift Card", desc: "Redeem for any PC game." }
  ];

  items.forEach(i => {
    box.appendChild(el("div", { class: "giveaway-card" }, [
      el("h2", {}, [i.title]),
      el("p", {}, [i.desc]),
      el("button", { class: "btn" }, ["Enter Giveaway"])
    ]));
  });

  // Attach OGAds locker to buttons
  setTimeout(() => {
    document.querySelectorAll(".giveaway-card .btn").forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        window.open(OGADS_LOCKER, "_blank");
      };
    });
  }, 500);
}

async function renderTrendingGames() {
  const grid = document.querySelector(".grid");
  if (!grid) return;

  const games = await loadWithCache("trending", () => fetchTrendingGames(6));

  const card = el("a", { class: "card", href: "news.html" }, [
    el("h2", {}, ["🔥 Trending Games"]),
    ...games.slice(0, 5).map(g => el("p", { class: "muted" }, [g.name]))
  ]);

  grid.insertBefore(card, grid.firstChild);
}

/* --------------------------------------
   BOOT LOGIC
-------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  // Mobile Nav
  const burger = document.getElementById("hamburger");
  const mainNav = document.getElementById("mainNav");
  if (burger && mainNav) {
    burger.onclick = () => {
      mainNav.style.display = mainNav.style.display === "flex" ? "none" : "flex";
    };
  }

  // Theme Restore
  const themeSel = document.getElementById("themeSelect");
  if (themeSel) {
    const saved = localStorage.getItem("siteTheme");
    if (saved) document.documentElement.classList.add(saved);
    themeSel.value = saved || "";
    themeSel.onchange = () => {
      document.documentElement.classList.remove("theme-roblox", "theme-fortnite");
      if (themeSel.value) document.documentElement.classList.add(themeSel.value);
      localStorage.setItem("siteTheme", themeSel.value);
    };
  }

  // Renderers (auto-detect page)
  if (document.querySelector(".news-list")) renderNewsPage();
  if (document.querySelector(".meme-grid")) renderMemesPage();
  if (document.querySelector(".profile-grid")) renderProfilesPage();
  if (document.querySelector(".forum-list")) renderForumsPage();
  if (document.querySelector(".giveaway-grid")) renderGiveawaysPage();
  if (document.querySelector(".grid")) renderTrendingGames();
});
