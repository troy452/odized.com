/* ============================================================
   GLOBAL CONFIG (API Keys + OGAds Locker)
============================================================ */

// Your REAL RapidAPI key (you provided it)
const GAME_NEWS_API_KEY = "d94adf1b6cmsh627c207e173a3e0p129a7fjsn20c9d926c0c1";

// OGAds Content Locker URL
const OGADS_LOCKER_URL = "https://redirectapps.online/cl/i/j76wev";

// Cache TTL
const CONFIG = {
  CACHE_TTL_MINUTES: 15,
};


/* ============================================================
   MOBILE NAV
============================================================ */
const hamburger = document.getElementById("hamburger");
const mainNav = document.getElementById("mainNav");

if (hamburger) {
  hamburger.addEventListener("click", () => {
    mainNav.style.display = mainNav.style.display === "flex" ? "none" : "flex";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (mainNav) {
    mainNav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        if (window.innerWidth < 861) {
          mainNav.style.display = "none";
        }
      });
    });
  }
});


/* ============================================================
   THEME SWITCHER
============================================================ */
const themeSelect = document.getElementById("themeSelect");

function applyTheme(theme) {
  document.documentElement.classList.remove("theme-roblox", "theme-fortnite");
  if (theme) document.documentElement.classList.add(theme);
  localStorage.setItem("siteTheme", theme);
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("siteTheme") || "";
  applyTheme(saved);
  if (themeSelect) themeSelect.value = saved;

  if (themeSelect) {
    themeSelect.addEventListener("change", e => {
      applyTheme(e.target.value);
    });
  }
});


/* ============================================================
   OGADS LOCKER REDIRECT
============================================================ */
function openLocker() {
  window.location.href = OGADS_LOCKER_URL;
}

// Auto-apply locker to giveaway buttons
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn").forEach(btn => {
    if (btn.textContent.includes("Enter Giveaway")) {
      btn.onclick = () => openLocker();
    }
  });
});


/* ============================================================
   CACHE SYSTEM
============================================================ */
function cacheSet(key, valueObj) {
  const payload = { ts: Date.now(), data: valueObj };
  localStorage.setItem(key, JSON.stringify(payload));
}

function cacheGet(key, maxAgeMin = CONFIG.CACHE_TTL_MINUTES) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    const age = (Date.now() - payload.ts) / 1000 / 60;

    if (age > maxAgeMin) return null;
    return payload.data;

  } catch {
    return null;
  }
}


/* ============================================================
   FETCH HELPERS
============================================================ */
async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  const res = await fetch(url, { ...opts, signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}

async function fetchReddit(sub, limit = 8) {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`;
  const res = await fetchWithTimeout(url);
  const json = await res.json();
  return json.data.children.map(p => p.data);
}


/* ============================================================
   DOM HELPER
============================================================ */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const key in attrs) {
    if (key === "class") node.className = attrs[key];
    else if (key === "html") node.innerHTML = attrs[key];
    else node.setAttribute(key, attrs[key]);
  }

  (Array.isArray(children) ? children : [children]).forEach(child => {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  });

  return node;
}


/* ============================================================
   NEWS API — RAPIDAPI INTEGRATION
============================================================ */

// Fetch gaming news from RapidAPI
async function renderNewsPage() {
  const container = document.querySelector(".news-list");
  if (!container) return;

  container.innerHTML = "Loading gaming news…";

  const API_URL = "https://games-news-api.p.rapidapi.com/news";

  try {
    const cached = cacheGet("all_gaming_news");
    if (cached) return renderNewsResults(cached, container);

    const res = await fetch(API_URL, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "games-news-api.p.rapidapi.com",
        "x-rapidapi-key": GAME_NEWS_API_KEY
      }
    });

    if (!res.ok) throw new Error("News API error");

    const data = await res.json();
    cacheSet("all_gaming_news", data);

    renderNewsResults(data, container);

  } catch (err) {
    container.innerHTML = "Failed to load news.";
    console.error(err);
  }
}

// Render news card list
function renderNewsResults(data, container) {
  container.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = "<div>No news available.</div>";
    return;
  }

  data.slice(0, 12).forEach(article => {
    const card = document.createElement("div");
    card.className = "news-item";

    const img = article.image_url
      ? `<img src="${article.image_url}" style="width:100%;border-radius:8px;margin-bottom:10px;">`
      : "";

    card.innerHTML = `
      ${img}
      <h2>${article.title}</h2>
      <p>${article.description ? article.description.slice(0, 200) + "…" : ""}</p>
      <a href="${article.url}" target="_blank">Read full article</a>
      <div class="date">${new Date(article.published).toLocaleString()}</div>
    `;

    container.appendChild(card);
  });
}


/* ============================================================
   MEMES PAGE
============================================================ */
async function renderMemesPage() {
  const container = document.querySelector(".meme-grid");
  if (!container) return;

  container.innerHTML = "Loading memes…";

  try {
    const memes = await fetchReddit("gamingmemes", 12);
    container.innerHTML = "";

    memes.forEach(m => {
      const img = m.url_overridden_by_dest || m.thumbnail;

      container.appendChild(
        el("div", { class: "meme-card" }, [
          img ? el("img", { src: img }) : "",
          el("p", {}, m.title)
        ])
      );
    });

  } catch {
    container.innerHTML = "Failed to load memes.";
  }
}


/* ============================================================
   PROFILES PAGE
============================================================ */
async function renderProfilesPage() {
  const grid = document.querySelector(".profile-grid");
  if (!grid) return;

  grid.innerHTML = "Loading profiles…";

  try {
    const res = await fetch("https://randomuser.me/api/?results=12");
    const data = await res.json();

    grid.innerHTML = "";

    data.results.forEach(u => {
      grid.appendChild(
        el("div", { class: "profile-card" }, [
          el("img", { src: u.picture.large }),
          el("h2", {}, `${u.name.first} ${u.name.last}`),
          el("p", {}, "@" + u.login.username)
        ])
      );
    });

  } catch {
    grid.innerHTML = "Failed to load profiles.";
  }
}


/* ============================================================
   FORUMS PAGE
============================================================ */
async function renderForumsPage() {
  const grid = document.querySelector(".forum-list");
  if (!grid) return;

  const categories = [
    { title: "Roblox Discussions", desc: "Avatars, builds, updates." },
    { title: "Fortnite Talk", desc: "Skins, drops, events." },
    { title: "Mobile Games", desc: "PUBG, Free Fire, CODM." },
    { title: "General Gaming", desc: "All platforms & genres." }
  ];

  categories.forEach(c => {
    grid.appendChild(
      el("div", { class: "forum-item" }, [
        el("h2", {}, c.title),
        el("p", {}, c.desc),
        el("div", { class: "meta" }, `${Math.floor(Math.random()*1500)} posts`),
        el("a", { class: "btn", href: "#" }, "Enter")
      ])
    );
  });
}


/* ============================================================
   GIVEAWAYS PAGE
============================================================ */
async function renderGiveawaysPage() {
  const grid = document.querySelector(".giveaway-grid");
  if (!grid) return;

  const items = [
    { title: "$20 Roblox Gift Card", desc: "Win a Roblox gift card." },
    { title: "1,000 V-Bucks", desc: "Fortnite currency prize." },
    { title: "Gaming Headset", desc: "Pro gaming headset." }
  ];

  items.forEach(item => {
    grid.appendChild(
      el("div", { class: "giveaway-card" }, [
        el("h2", {}, item.title),
        el("p", {}, item.desc),
        el("button", { class: "btn", onclick: "openLocker()" }, "Enter Giveaway")
      ])
    );
  });
}


/* ============================================================
   PAGE DETECTOR & BOOT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".news-list")) renderNewsPage();
  if (document.querySelector(".meme-grid")) renderMemesPage();
  if (document.querySelector(".profile-grid")) renderProfilesPage();
  if (document.querySelector(".forum-list")) renderForumsPage();
  if (document.querySelector(".giveaway-grid")) renderGiveawaysPage();
});
