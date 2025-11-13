/**
 * Live Content Loader for Gaming Community Hub
 * - Caching (localStorage) with TTL
 * - Multiple data sources + fallbacks
 * - Add API keys in `CONFIG` below for higher-quality sources
 *
 * Default TTL: 15 minutes (change CONFIG.CACHE_TTL_MINUTES)
 *
 * Notes:
 *  - Some 3rd-party APIs require API keys (RAWG, Fortnite third-party, etc.)
 *  - Where keys are not provided, code falls back to reddit feeds or Roblox blog
 *  - Reddit JSON endpoints are used without auth; CORS may block on some hosts — GitHub Pages normally works
 */

/* ----------------------
   CONFIG — put your keys here if you have them
   ---------------------- */
const CONFIG = {
  CACHE_TTL_MINUTES: 15, // caching TTL
  FORTNITE_API_KEY: "",  // optional: e.g. fortniteapi.io or other service API key
  RAWG_API_KEY: "",      // optional: https://rawg.io/ (better trending games)
  PANDASCORE_API_KEY: "" // optional: for esports (PandaScore)
};

/* ----------------------
   Simple caching helpers
   ---------------------- */
function cacheSet(key, valueObj) {
  const payload = {
    ts: Date.now(),
    data: valueObj
  };
  localStorage.setItem(key, JSON.stringify(payload));
}
function cacheGet(key, maxAgeMinutes = CONFIG.CACHE_TTL_MINUTES) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload.ts) return null;
    const age = (Date.now() - payload.ts) / 1000 / 60;
    if (age > maxAgeMinutes) {
      localStorage.removeItem(key);
      return null;
    }
    return payload.data;
  } catch (e) {
    console.warn("Cache read error", e);
    return null;
  }
}

/* ----------------------
   Utility DOM helpers
   ---------------------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") node.className = attrs[k];
    else if (k === "html") node.innerHTML = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (!c) return;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });
  return node;
}
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (e) { return iso; }
}

/* ----------------------
   Fetch helpers & fallbacks
   ---------------------- */

/* Generic fetch with timeout */
async function fetchWithTimeout(url, opts = {}, ms = 9000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {...opts, signal: controller.signal});
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/* Reddit JSON helper (no auth) */
async function fetchReddit(subreddit, limit = 8) {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
  const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } });
  const json = await res.json();
  const posts = (json.data && json.data.children) ? json.data.children.map(c => c.data) : [];
  return posts;
}

/* Roblox blog posts (public WP JSON) */
async function fetchRobloxBlog(limit = 6) {
  const url = `https://blog.roblox.com/wp-json/wp/v2/posts?per_page=${limit}`;
  const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } });
  return res.json(); // array of posts
}

/* RAWG trending games (optional key) */
async function fetchTrendingGames(limit = 8) {
  if (CONFIG.RAWG_API_KEY) {
    const url = `https://api.rawg.io/api/games/lists/popular?key=${CONFIG.RAWG_API_KEY}&page_size=${limit}`;
    const r = await fetchWithTimeout(url);
    const j = await r.json();
    return j.results || [];
  } else {
    // fallback: use Reddit r/gaming top posts to infer trending games
    const posts = await fetchReddit("gaming", limit);
    return posts.map(p => ({ name: p.title, reddit: true, url: `https://reddit.com${p.permalink}` }));
  }
}

/* Fortnite data — prefer 3rd-party API when key present; fallback to subreddit */
async function fetchFortniteNews(limit = 6) {
  if (CONFIG.FORTNITE_API_KEY) {
    // Example placeholder: you'd replace this with the provider's endpoint
    const url = `https://fortniteapi.io/news?lang=en`; // provider-specific
    const res = await fetchWithTimeout(url, { headers: { 'Authorization': CONFIG.FORTNITE_API_KEY } });
    const j = await res.json();
    return j.items || [];
  } else {
    return fetchReddit("FortNiteBR", limit);
  }
}

/* Esports (PandaScore if key, otherwise Reddit r/esports) */
async function fetchEsports(limit = 6) {
  if (CONFIG.PANDASCORE_API_KEY) {
    const url = `https://api.pandascore.co/tournaments?token=${CONFIG.PANDASCORE_API_KEY}&per_page=${limit}`;
    const res = await fetchWithTimeout(url);
    const j = await res.json();
    return j;
  } else {
    return fetchReddit("esports", limit);
  }
}

/* Random avatars */
async function fetchRandomProfiles(count = 8) {
  const url = `https://randomuser.me/api/?results=${count}&inc=name,picture,login`;
  const res = await fetchWithTimeout(url);
  const j = await res.json();
  return j.results || [];
}

/* Memes: try meme subreddits */
async function fetchMemes(limit = 12) {
  const subs = ["gamingmemes","dankmemes","memes"];
  // fetch from multiple subs, combine
  const promises = subs.map(s => fetchReddit(s, Math.ceil(limit / subs.length)).catch(()=>[]));
  const results = await Promise.all(promises);
  return results.flat().slice(0, limit);
}

/* Generic function to load with cache key */
async function loadWithCache(key, loader, ttlMinutes) {
  const cached = cacheGet(key, ttlMinutes);
  if (cached) return cached;
  try {
    const fresh = await loader();
    cacheSet(key, fresh);
    return fresh;
  } catch (e) {
    console.warn("Loader failed for", key, e);
    const fallback = cacheGet(key, ttlMinutes*4); // try older cache
    if (fallback) return fallback;
    throw e;
  }
}

/* ----------------------
   Renderers for each page
   ---------------------- */

async function renderNewsPage() {
  const container = document.querySelector('.news-list');
  if (!container) return;
  container.innerHTML = '<div class="news-loading">Loading news…</div>';

  try {
    const [roblox, gamingReddit] = await Promise.all([
      loadWithCache('roblox_blog', () => fetchRobloxBlog(8), CONFIG.CACHE_TTL_MINUTES),
      loadWithCache('gaming_reddit', () => fetchReddit('gaming', 10), CONFIG.CACHE_TTL_MINUTES)
    ]);

    container.innerHTML = ''; // clear

    // Roblox blog posts (if present)
    if (Array.isArray(roblox) && roblox.length > 0) {
      roblox.slice(0,5).forEach(post => {
        const card = el('div', { class: 'news-item' }, [
          el('h2', {}, [ post.title && (post.title.rendered || post.title) ]),
          el('p', {}, [ post.excerpt ? (post.excerpt.replace(/<[^>]+>/g,'').slice(0,220) + '…') : '' ]),
          el('div', { class: 'date' }, [ formatDate(post.date || new Date().toISOString()) ])
        ]);
        container.appendChild(card);
      });
    }

    // Reddit gaming posts
    if (Array.isArray(gamingReddit) && gamingReddit.length>0) {
      gamingReddit.slice(0,6).forEach(p => {
        const card = el('div', { class: 'news-item' }, [
          el('h2', {}, [ p.title ]),
          el('p', {}, [ p.selftext ? p.selftext.slice(0,220) + '…' : (p.title).slice(0,220) ]),
          el('a', { href: 'https://reddit.com' + p.permalink, target:'_blank' }, [ 'Read on Reddit' ]),
          el('div', { class: 'date' }, [ formatDate(new Date(p.created_utc*1000).toISOString()) ])
        ]);
        container.appendChild(card);
      });
    }

  } catch (e) {
    container.innerHTML = `<div class="news-error">Failed to load news. Try again later.</div>`;
    console.error(e);
  }
}

async function renderMemesPage() {
  const container = document.querySelector('.meme-grid');
  if (!container) return;
  container.innerHTML = '<div class="news-loading">Loading memes…</div>';

  try {
    const memes = await loadWithCache('memes', () => fetchMemes(12), CONFIG.CACHE_TTL_MINUTES);
    container.innerHTML = '';

    memes.forEach(m => {
      // reddit post image detection
      const imgUrl = m.url_overridden_by_dest || m.thumbnail || (m.preview && m.preview.images && m.preview.images[0] && m.preview.images[0].source.url);
      const safeImg = imgUrl && imgUrl.startsWith('http') ? imgUrl.replace(/&amp;/g,'&') : null;
      const card = el('div', { class: 'meme-card' }, []);
      if (safeImg) card.appendChild(el('img', { src: safeImg, alt: m.title || 'meme' }));
      card.appendChild(el('p', {}, [ m.title || '' ]));
      container.appendChild(card);
    });

  } catch (e) {
    container.innerHTML = '<div class="news-error">Memes could not be loaded.</div>';
    console.error(e);
  }
}

async function renderForumsPage() {
  const container = document.querySelector('.forum-list');
  if (!container) return;
  container.innerHTML = '';

  // generate forum category cards with simulated stats (static but realistic)
  const categories = [
    { title: 'Roblox Discussions', desc: 'Avatar ideas, events, favorite games, and building help.' },
    { title: 'Fortnite Battle Talk', desc: 'Drop locations, skins, clips, updates, and strategies.' },
    { title: 'Mobile Games', desc: 'Free Fire, PUBG Mobile, CODM, and more mobile gaming chats.' },
    { title: 'General Gaming', desc: 'Any game, any platform — talk about anything!' }
  ];

  categories.forEach((c, i) => {
    const card = el('div', { class: 'forum-item' }, [
      el('h2', {}, [c.title]),
      el('p', {}, [c.desc]),
      el('div', { class: 'meta' }, [ `${Math.floor(Math.random()*1800)+20} posts • ${Math.floor(Math.random()*200)+2} active` ]),
      el('a', { class: 'btn', href: '#'}, ['Enter'])
    ]);
    container.appendChild(card);
  });
}

async function renderProfilesPage() {
  const container = document.querySelector('.profile-grid');
  if (!container) return;
  container.innerHTML = '<div class="news-loading">Loading profiles…</div>';

  try {
    const profiles = await loadWithCache('profiles_random', () => fetchRandomProfiles(12), CONFIG.CACHE_TTL_MINUTES);
    container.innerHTML = '';
    profiles.forEach(p => {
      const name = `${p.name.first} ${p.name.last}`;
      const avatar = p.picture && (p.picture.large || p.picture.medium || p.picture.thumbnail);
      const card = el('div', { class: 'profile-card' }, [
        el('img', { src: avatar, alt: name }),
        el('h2', {}, [name]),
        el('p', {}, [ `Gamer Tag: ${p.login.username}` ]),
        el('span', { class: 'rank' }, [ `Rank #${Math.floor(Math.random()*200)+1}` ])
      ]);
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = '<div class="news-error">Profiles failed to load.</div>';
    console.error(e);
  }
}

async function renderGiveawaysPage() {
  const container = document.querySelector('.giveaway-grid');
  if (!container) return;
  container.innerHTML = '';

  // Example: show a mix of static featured giveaways + countdown
  const items = [
    { title: '$20 Roblox Gift Card', desc: 'Enter to win a Roblox digital card. Winner chosen monthly.' },
    { title: '1,000 V-Bucks', desc: 'Win Fortnite V-Bucks for skins, emotes, and battle passes.' },
    { title: 'Gaming Headset', desc: 'High-quality headset perfect for streaming and gaming.' },
    { title: 'Gaming Mouse', desc: 'Precision mouse for competitive play.' },
    { title: 'Steam Gift Card', desc: 'Redeemable on Steam for games and DLC.' }
  ];

  items.forEach((it, idx) => {
    const endsInDays = Math.max(1, 14 - idx * 2); // simple variation
    const card = el('div', { class: 'giveaway-card' }, [
      el('h2', {}, [it.title]),
      el('p', {}, [it.desc]),
      el('div', { class: 'date' }, [ `Ends in ${endsInDays} day${endsInDays>1?'s':''}` ]),
      el('button', { class: 'btn' }, ['Enter Giveaway'])
    ]);
    container.appendChild(card);
  });
}

async function renderTrendingGamesSection() {
  // Inject into home grid a small trending list if ".grid" exists
  const grid = document.querySelector('.grid');
  if (!grid) return;
  try {
    const games = await loadWithCache('trending_games', () => fetchTrendingGames(6), CONFIG.CACHE_TTL_MINUTES);
    const box = el('a', { class: 'card', href: 'news.html' }, [
      el('h2', {}, ['🔥 Trending Games']),
      el('div', {}, [ ...games.slice(0,5).map(g => el('div', { class: 'muted' }, [ g.name || g.title || (g.reddit && 'Reddit post') ])) ])
    ]);
    grid.insertBefore(box, grid.firstChild);
  } catch (e) {
    console.warn("Trending games failed", e);
  }
}

/* ----------------------
   Page detection & boot
   ---------------------- */
async function bootLiveContent() {
  // Theme switcher handler (exists in all pages)
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const v = e.target.value;
      document.documentElement.classList.remove('theme-roblox','theme-fortnite');
      if (v) document.documentElement.classList.add(v);
      localStorage.setItem('siteTheme', v);
    });
    // load saved
    const saved = localStorage.getItem('siteTheme') || '';
    if (saved) {
      themeSelect.value = saved;
      document.documentElement.classList.add(saved);
    }
  }

  // Mobile nav already handled in your script.js earlier; keep it

  // Decide which renderers to run based on page presence
  const promises = [];
  if (document.querySelector('.news-list')) promises.push(renderNewsPage());
  if (document.querySelector('.meme-grid')) promises.push(renderMemesPage());
  if (document.querySelector('.forum-list')) promises.push(renderForumsPage());
  if (document.querySelector('.profile-grid')) promises.push(renderProfilesPage());
  if (document.querySelector('.giveaway-grid')) promises.push(renderGiveawaysPage());
  if (document.querySelector('.grid')) promises.push(renderTrendingGamesSection());

  // Wait for everything (don't block UI)
  try {
    await Promise.all(promises);
  } catch (e) {
    console.warn("Some loaders failed", e);
  }
}

/* auto-run after DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  // give UI a short delay for feel
  setTimeout(() => {
    bootLiveContent();
  }, 250);
});
// User script.js provided
