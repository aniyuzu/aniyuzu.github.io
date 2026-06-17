// script.js (ES module)
const HAMBURGER = document.getElementById('hamburger');
const SIDE_MENU = document.getElementById('side-menu');
const OVERLAY = document.getElementById('overlay');
const SEARCH_INPUT = document.getElementById('search-input');
const SEARCH_BTN = document.getElementById('search-btn');
const ANIME_GRID = document.getElementById('anime-grid');
const MENU_USERNAME = document.getElementById('menu-username');
const USER_AREA = document.getElementById('user-area');

let menuOpen = false;

function openMenu() {
  SIDE_MENU.classList.remove('hidden');
  OVERLAY.classList.remove('hidden');
  HAMBURGER.setAttribute('aria-expanded','true');
  menuOpen = true;
}
function closeMenu() {
  SIDE_MENU.classList.add('hidden');
  OVERLAY.classList.add('hidden');
  HAMBURGER.setAttribute('aria-expanded','false');
  menuOpen = false;
}

HAMBURGER.addEventListener('click', () => {
  menuOpen ? closeMenu() : openMenu();
});
OVERLAY.addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuOpen) closeMenu();
});

// Search redirect
SEARCH_BTN.addEventListener('click', () => {
  const q = SEARCH_INPUT.value.trim();
  if (q) window.location.href = `/search?title=${encodeURIComponent(q)}`;
});
SEARCH_INPUT.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') SEARCH_BTN.click();
});

// Lazy load images with placeholder /load_icon.gif
function lazyLoadImages(root = document) {
  const imgs = root.querySelectorAll('img.lazy[data-src]');
  const onLoad = (img) => {
    const src = img.dataset.src;
    if (!src) return;
    const tmp = new Image();
    tmp.src = src;
    tmp.onload = () => {
      img.src = src;
      img.classList.remove('lazy');
    };
    tmp.onerror = () => {
      // keep placeholder if failed
    };
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          onLoad(e.target);
          obs.unobserve(e.target);
        }
      });
    }, {rootMargin: '200px'});
    imgs.forEach(i => io.observe(i));
  } else {
    imgs.forEach(onLoad);
  }
}

// Supabase init (replace with your values)
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON = 'public-anon-key';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Fetch popular anime from Supabase table "anime" (example schema: id, title, poster_url, popularity)
async function loadPopularAnime() {
  try {
    // Attempt to fetch from Supabase
    const { data, error } = await supabase
      .from('anime')
      .select('id,title,poster_url,slug')
      .order('popularity', { ascending: false })
      .limit(24);

    if (error) throw error;

    if (!data || data.length === 0) {
      renderFallback();
      return;
    }

    renderAnimeCards(data);
  } catch (err) {
    console.warn('Supabase fetch failed, using fallback data', err);
    renderFallback();
  } finally {
    lazyLoadImages();
  }
}

// Render functions
function renderAnimeCards(items) {
  ANIME_GRID.innerHTML = '';
  items.forEach(item => {
    const slug = item.slug || encodeURIComponent(item.title.replace(/\s+/g,'-'));
    const poster = item.poster_url || '';
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <a href="/title/${encodeURIComponent(slug)}/" class="card-link" aria-label="${escapeHtml(item.title)}">
        <div class="poster">
          <img src="/load_icon.gif" data-src="${escapeAttr(poster)}" alt="${escapeHtml(item.title)} poster" class="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
        </div>
      </a>
    `;
    ANIME_GRID.appendChild(card);
  });
}

function renderFallback() {
  const sample = [
    { title: 'Naruto', poster: 'https://i.imgur.com/placeholder1.jpg', slug: 'Naruto' },
    { title: 'One Piece', poster: 'https://i.imgur.com/placeholder2.jpg', slug: 'OnePiece' },
    { title: 'Attack on Titan', poster: 'https://i.imgur.com/placeholder3.jpg', slug: 'AOT' },
    { title: 'My Hero Academia', poster: 'https://i.imgur.com/placeholder4.jpg', slug: 'MHA' }
  ];
  ANIME_GRID.innerHTML = '';
  sample.forEach(it => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <a href="/title/${encodeURIComponent(it.slug)}/" class="card-link" aria-label="${escapeHtml(it.title)}">
        <div class="poster">
          <img src="/load_icon.gif" data-src="${escapeAttr(it.poster)}" alt="${escapeHtml(it.title)} poster" class="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(it.title)}</h3>
        </div>
      </a>
    `;
    ANIME_GRID.appendChild(card);
  });
}

// Simple escaping helpers
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return s ? s.replace(/"/g,'&quot;') : ''; }

// Get user info from Supabase auth and show email or "Zaloguj"
async function showUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data?.user;
    if (user) {
      const name = user.email || user.user_metadata?.full_name || 'User';
      MENU_USERNAME.textContent = name;
      USER_AREA.textContent = name;
    } else {
      MENU_USERNAME.textContent = 'Username';
      USER_AREA.textContent = 'Zaloguj';
    }
  } catch (e) {
    MENU_USERNAME.textContent = 'Username';
    USER_AREA.textContent = 'Zaloguj';
  }
}

// Theme toggle (simple)
const THEME_TOGGLE = document.getElementById('theme-toggle');
THEME_TOGGLE.addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadPopularAnime();
  showUser();
  lazyLoadImages();
});
