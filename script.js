/* ============================================================
   CONFIG + GLOBAL SETTINGS
============================================================ */

// OGAds Locker URL
const OGADS_LOCKER_URL = "https://redirectapps.online/cl/i/j76wev";

// Cache duration
const CACHE_TTL = 15; // minutes


/* ============================================================
   MOBILE NAV
============================================================ */
const hamburger = document.getElementById("hamburger");
const mainNav = document.getElementById("mainNav");

if (hamburger) {
  hamburger.addEventListener("click", () => {
    mainNav.style.display = (mainNav.style.display === "flex" ? "none" : "flex");
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
   THEME SWITCHER (fixed)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const themeSelect = document.getElementById("themeSelect");
  const savedTheme = localStorage.getItem("siteTheme") || "";

  if (savedTheme) {
    document.documentElement.classList.add(savedTheme);
  }

  if (themeSelect) {
    themeSelect.value = savedTheme;

    themeSelect.addEventListener("change", () => {
      const theme = themeSelect.value;
      document.documentElement.classList.remove("theme-roblox", "theme-fortnite");
      if (theme) document.documentElement.classList.add(theme);
      localStorage.setItem("siteTheme", theme);
    });
  }
});


/* ============================================================
   OGADS CONTENT LOCKER
============================================================ */
function openLocker() {
  window.location.href = OGADS_LOCKER_URL;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn").forEach(btn => {
    if (btn.textContent.includes("Enter Giveaway")) {
      btn.onclick = () => openLocker();
    }
  });
});


/* ============================================================
   CACHING SYSTEM
============================================================ */
function cacheSet(key, data) {
  const payload = { ts: Date.now(), data };
  localStorage.setItem(key, JSON.stringify(payload));
}

function cacheGet(key, ttlMin = CACHE_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const age = (Date.now() - parsed.ts) / 1000 / 60;

    if (age > ttlMin) return null;
    return parsed.data;

  } catch {
    return null;
  }
}


/* ============================================================
   HELPER FUNCTION
============================================================ */
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const a in attrs) {
    if (a === "class") n.className = attrs[a];
    else if (a === "html") n.innerHTML = attrs[a];
    else n.setAttribute(a, attrs[a]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c =>
    typeof c === "string" ? n.appendChild(document.createTextNode(c)) : c && n.appendChild(c)
  );
  return n;
}


/* ============================================================
   GOOGLE NEWS RSS FETCHER
============================================================ */

// Google News (Gaming) RSS → JSON
const GOOGLE_NEWS_URL =
  "https://api.rss2json.com/v1/api.json?rss_url=https://news.google.com/rss/search?q=gaming&hl=en-US&gl=US&ceid=US:en";

async function renderNewsPage() {
  const container = document.querySelector(".news-list");
  if (!container) return;

  container.innerHTML = `<div class="news-loading">Loading Google News…</div>`;

  try {
    const cached = cacheGet("google_news_gaming");
    if (cached) {
      return renderGoogleNews(cached, container);
    }

    const res = await fetch(GOOGLE_NEWS_URL);
    if (!res.ok) throw new Error("Google RSS failed");

    const json = await res.json();

    cacheSet("google_news_gaming", json);

    renderGoogleNews(json, container);

  } catch (e) {
    container.innerHTML = `<div class="news-error">Failed to load Google News.</div>`;
    console.error(e);
  }
}

function renderGoogleNews(json, container) {
  container.innerHTML = "";

  if (!json.items || json.items.length === 0) {
    container.innerHTML = `<div>No news available.</div>`;
    return;
  }

  json.items.slice(0, 12).forEach(article => {
    const thumb = article.thumbnail || "";
    const cleanDesc = article.description.replace(/<[^>]+>/g, "").slice(0, 200) + "…";

    const card = el("div", { class: "news-item" }, [
      thumb ? el("img", { src: thumb }) : "",
      el("h2", {}, article.title),
      el("p", {}, cleanDesc),
      el("a", { href: article.link, target: "_blank" }, "Read full article"),
      el("div", { class: "date" }, new Date(article.pubDate).toLocaleString())
    ]);

    container.appendChild(card);
  });
}


/* ============================================================
   MEMES PAGE (Reddit)
============================================================ */
async function renderMemesPage() {
  const grid = document.querySelector(".meme-grid");
  if (!grid) return;

  grid.innerHTML = "Loading memes…";

  try {
    const res = await fetch("https://www.reddit.com/r/gamingmemes/hot.json?limit=12");
    const json = await res.json();
    const memes = json.data.children.map(m => m.data);

    grid.innerHTML = "";

    memes.forEach(m => {
      const img = m.url_overridden_by_dest;

      grid.appendChild(
        el("div", { class: "meme-card" }, [
          img ? el("img", { src: img }) : "",
          el("p", {}, m.title)
        ])
      );
    });

  } catch {
    grid.innerHTML = "Failed to load memes.";
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

  grid.innerHTML = "";

  categories.forEach(c => {
    grid.appendChild(
      el("div", { class: "forum-item" }, [
        el("h2", {}, c.title),
        el("p", {}, c.desc),
        el("div", { class: "meta" }, `${Math.floor(Math.random()*1200)} posts`),
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

  grid.innerHTML = "";

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
   PAGE DETECTOR & AUTO-INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".news-list")) renderNewsPage();
  if (document.querySelector(".meme-grid")) renderMemesPage();
  if (document.querySelector(".profile-grid")) renderProfilesPage();
  if (document.querySelector(".forum-list")) renderForumsPage();
  if (document.querySelector(".giveaway-grid")) renderGiveawaysPage();
});
