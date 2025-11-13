/* ---------------------------------------
   OGADS LOCKER CONFIG
--------------------------------------- */
const OGADS_LOCKER_URL = "https://redirectapps.online/cl/i/j76wev";

/* ---------------------------------------
   MOBILE NAV
--------------------------------------- */
const hamburger = document.getElementById("hamburger");
const mainNav = document.getElementById("mainNav");

if (hamburger) {
  hamburger.addEventListener("click", () => {
    mainNav.style.display = mainNav.style.display === "flex" ? "none" : "flex";
  });
}

/* Close mobile menu when clicking a link */
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

/* ---------------------------------------
   THEME SWITCHER
--------------------------------------- */
const themeSelect = document.getElementById("themeSelect");

function applyTheme(theme) {
  document.documentElement.classList.remove("theme-roblox", "theme-fortnite");
  if (theme) document.documentElement.classList.add(theme);
  localStorage.setItem("siteTheme", theme);
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("siteTheme") || "";
  applyTheme(savedTheme);
  if (themeSelect) themeSelect.value = savedTheme;

  if (themeSelect) {
    themeSelect.addEventListener("change", e => {
      applyTheme(e.target.value);
    });
  }
});

/* ---------------------------------------
   OGADS LOCKER HANDLER
--------------------------------------- */
function openLocker() {
  window.location.href = OGADS_LOCKER_URL;
}

/* Automatically attach locker to all giveaway buttons */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn").forEach(btn => {
    if (btn.textContent.includes("Enter Giveaway")) {
      btn.onclick = () => openLocker();
    }
  });
});

/* ---------------------------------------
   CACHING SYSTEM
--------------------------------------- */
const CONFIG = {
  CACHE_TTL_MINUTES: 15,
  FORTNITE_API_KEY: "",
  RAWG_API_KEY: "",
  PANDASCORE_API_KEY: ""
};

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
  } catch {
    return null;
  }
}

/* ---------------------------------------
   FETCH HELPERS
--------------------------------------- */
async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function fetchReddit(sub, limit = 8) {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  return data.data.children.map(p => p.data);
}

async function fetchRobloxBlog(limit = 6) {
  const url = `https://blog.roblox.com/wp-json/wp/v2/posts?per_page=${limit}`;
  const res = await fetchWithTimeout(url);
  return res.json();
}

/* ---------------------------------------
   ELEMENT HELPER
--------------------------------------- */
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

function formatDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

/* ---------------------------------------
   PAGE RENDERERS
--------------------------------------- */
async function renderNewsPage() {
  const container = document.querySelector(".news-list");
  if (!container) return;
  container.innerHTML = "Loading news...";

  try {
    const [roblox, gaming] = await Promise.all([
      fetchRobloxBlog(6),
      fetchReddit("gaming", 8)
    ]);

    container.innerHTML = "";

    roblox.forEach(post => {
      container.appendChild(
        el("div", { class: "news-item" }, [
          el("h2", {}, post.title.rendered),
          el("p", {}, post.excerpt.rendered.replace(/<[^>]+>/g, "").slice(0, 180)),
          el("div", { class: "date" }, formatDate(post.date))
        ])
      );
    });

    gaming.forEach(p => {
      container.appendChild(
        el("div", { class: "news-item" }, [
          el("h2", {}, p.title),
          el("p", {}, p.selftext.slice(0, 150)),
          el("a", { href: "https://reddit.com" + p.permalink, target: "_blank" }, "Read on Reddit")
        ])
      );
    });
  } catch (e) {
    container.innerHTML = "Failed to load news.";
  }
}

async function renderMemesPage() {
  const container = document.querySelector(".meme-grid");
  if (!container) return;
  container.innerHTML = "Loading memes...";

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

async function renderProfilesPage() {
  const c = document.querySelector(".profile-grid");
  if (!c) return;
  c.innerHTML = "Loading profiles...";

  try {
    const res = await fetch("https://randomuser.me/api/?results=12");
    const json = await res.json();
    c.innerHTML = "";

    json.results.forEach(u => {
      c.appendChild(
        el("div", { class: "profile-card" }, [
          el("img", { src: u.picture.large }),
          el("h2", {}, `${u.name.first} ${u.name.last}`),
          el("p", {}, "@" + u.login.username)
        ])
      );
    });
  } catch {
    c.innerHTML = "Failed to load profiles.";
  }
}

async function renderGiveawaysPage() {
  const c = document.querySelector(".giveaway-grid");
  if (!c) return;

  const items = [
    { title: "$20 Roblox Gift Card", desc: "Win a Roblox digital gift card." },
    { title: "1,000 V-Bucks", desc: "Fortnite V-Bucks for skins & passes." },
    { title: "Gaming Headset", desc: "Premium audio gaming headset." }
  ];

  c.innerHTML = "";
  items.forEach(item =>
    c.appendChild(
      el("div", { class: "giveaway-card" }, [
        el("h2", {}, item.title),
        el("p", {}, item.desc),
        el("button", { class: "btn", onclick: "openLocker()" }, "Enter Giveaway")
      ])
    )
  );
}

/* ---------------------------------------
   BOOT SYSTEM
--------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".news-list")) renderNewsPage();
  if (document.querySelector(".meme-grid")) renderMemesPage();
  if (document.querySelector(".profile-grid")) renderProfilesPage();
  if (document.querySelector(".giveaway-grid")) renderGiveawaysPage();
});
