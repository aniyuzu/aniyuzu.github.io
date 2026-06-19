/* ================================================================
   AniYuzu — script.js
   Sections:
     1. Supabase config & init
     2. DOM references
     3. Navbar scroll shadow
     4. Side menu (open / close)
     5. Mobile search toggle
     6. Search redirect  →  /search?title=
     7. Auth (session → UI update)
     8. Jikan API helpers
     9. Card builder
    10. Grid renderer
    11. Helpers
    12. Bootstrap
================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. SUPABASE CONFIGURATION
   ① Create a project at https://supabase.com
   ② Go to:  Project Settings → API
   ③ Paste your Project URL and anon/public key below.
   ─────────────────────────────────────────────────────────────── */
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

/* ─── Init Supabase client (skipped if not configured) ──────── */
let sb = null;

(function initSupabase() {
    if (
        typeof window.supabase === 'undefined' ||
        SUPABASE_URL      === 'YOUR_SUPABASE_URL' ||
        SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY'
    ) {
        console.info('[AniYuzu] Supabase not configured — auth disabled.');
        return;
    }
    try {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
        console.warn('[AniYuzu] Supabase init failed:', err);
    }
}());


/* ════════════════════════════════════════════════════════════════
   2. DOM REFERENCES
================================================================ */
const g = (id) => document.getElementById(id);

const navbar            = g('navbar');
const menuBtn           = g('menuBtn');
const menuIcon          = g('menuIcon');
const closeBtn          = g('closeBtn');
const sidemenu          = g('sidemenu');
const backdrop          = g('backdrop');
const searchForm        = g('searchForm');
const searchInput       = g('searchInput');
const mobileSearchBtn   = g('mobileSearchBtn');
const mobileSearch      = g('mobileSearch');
const mobileSearchForm  = g('mobileSearchForm');
const mobileSearchInput = g('mobileSearchInput');
const accountLink       = g('accountLink');
const accountLabel      = g('accountLabel');
const accountIcon       = g('accountIcon');
const authBtn           = g('authBtn');
const popularGrid       = g('popularGrid');
const classicsGrid      = g('classicsGrid');


/* ════════════════════════════════════════════════════════════════
   3. NAVBAR — scroll shadow
================================================================ */
window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });


/* ════════════════════════════════════════════════════════════════
   4. SIDE MENU
================================================================ */
function openMenu() {
    sidemenu?.classList.add('open');
    sidemenu?.setAttribute('aria-hidden', 'false');
    backdrop?.classList.add('active');
    menuBtn?.setAttribute('aria-expanded', 'true');
    if (menuIcon) menuIcon.textContent = 'close';
    document.body.style.overflow = 'hidden';
}

function closeMenu() {
    sidemenu?.classList.remove('open');
    sidemenu?.setAttribute('aria-hidden', 'true');
    backdrop?.classList.remove('active');
    menuBtn?.setAttribute('aria-expanded', 'false');
    if (menuIcon) menuIcon.textContent = 'menu';
    document.body.style.overflow = '';
}

menuBtn?.addEventListener('click', openMenu);
closeBtn?.addEventListener('click', closeMenu);
backdrop?.addEventListener('click', closeMenu);

/* Close on Escape key */
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeMenu();
    closeMobileSearch();
});


/* ════════════════════════════════════════════════════════════════
   5. MOBILE SEARCH TOGGLE
================================================================ */
function openMobileSearch() {
    mobileSearch?.classList.add('open');
    mobileSearch?.setAttribute('aria-hidden', 'false');
    /* Small delay so the expand animation plays before focus */
    setTimeout(() => mobileSearchInput?.focus(), 60);
}

function closeMobileSearch() {
    mobileSearch?.classList.remove('open');
    mobileSearch?.setAttribute('aria-hidden', 'true');
}

mobileSearchBtn?.addEventListener('click', () => {
    const isOpen = mobileSearch?.classList.contains('open');
    isOpen ? closeMobileSearch() : openMobileSearch();
});


/* ════════════════════════════════════════════════════════════════
   6. SEARCH — redirect to /search?title=
================================================================ */
function doSearch(input) {
    const q = input?.value.trim();
    if (!q) {
        /* Subtle shake + focus when query is empty */
        input?.classList.add('shake');
        input?.focus();
        setTimeout(() => input?.classList.remove('shake'), 480);
        return;
    }
    window.location.href = `/search?title=${encodeURIComponent(q)}`;
}

searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(searchInput);
});

mobileSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(mobileSearchInput);
});


/* ════════════════════════════════════════════════════════════════
   7. AUTH — Supabase session → UI update
================================================================ */

/* Update the sidemenu account link & auth button */
function applyUserUI(user) {
    if (user) {
        const displayName =
            user.user_metadata?.username  ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0]     ||
            'My Account';

        if (accountLabel) accountLabel.textContent = displayName;
        if (accountIcon)  accountIcon.textContent  = 'account_circle';
        if (accountLink)  accountLink.href         = '/profile';

        if (authBtn) {
            authBtn.textContent = 'Log Out';
            authBtn.classList.add('logged-in');
        }
    } else {
        if (accountLabel) accountLabel.textContent = 'Account';
        if (accountIcon)  accountIcon.textContent  = 'person';
        if (accountLink)  accountLink.href         = '/account';

        if (authBtn) {
            authBtn.textContent = 'Login / Register';
            authBtn.classList.remove('logged-in');
        }
    }
}

async function initAuth() {
    if (!sb) return;

    /* Hydrate from stored session */
    const { data: { session } } = await sb.auth.getSession();
    applyUserUI(session?.user ?? null);

    /* Keep UI in sync on tab changes, token refresh, sign-out, etc. */
    sb.auth.onAuthStateChange((_event, newSession) => {
        applyUserUI(newSession?.user ?? null);
    });

    /* Auth button click: log out if signed in, navigate to /account if not */
    authBtn?.addEventListener('click', async () => {
        const { data: { session: current } } = await sb.auth.getSession();
        if (current) {
            await sb.auth.signOut();
            closeMenu();
        } else {
            window.location.href = '/account';
        }
    });
}


/* ════════════════════════════════════════════════════════════════
   8. JIKAN REST API  (https://api.jikan.moe — free, no key)
================================================================ */
const JIKAN = 'https://api.jikan.moe/v4';

async function fetchAnime(path) {
    try {
        const res = await fetch(`${JIKAN}${path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return Array.isArray(json.data) ? json.data : [];
    } catch (err) {
        console.warn('[AniYuzu] Fetch error:', err.message);
        return [];
    }
}


/* ════════════════════════════════════════════════════════════════
   9. CARD BUILDER
================================================================ */

/* Returns badge markup based on the anime's rank */
function badgeMarkup(rank) {
    if (!rank) return '';
    if (rank === 1) return '<span class="card__badge card__badge--top">Top #1</span>';
    if (rank <= 3)  return `<span class="card__badge card__badge--top">Top #${rank}</span>`;
    if (rank <= 10) return `<span class="card__badge card__badge--new">#${rank}</span>`;
    return '';
}

function buildCard(anime, index = 0) {
    const title  = anime.title || 'Unknown';
    const slug   = encodeURIComponent(anime.title_english || title);
    const imgSrc = anime.images?.jpg?.large_image_url || '';
    const score  = typeof anime.score === 'number' ? anime.score.toFixed(1) : null;
    const eps    = anime.episodes || null;
    const genre  = anime.genres?.[0]?.name || '';
    const year   = anime.year || anime.aired?.prop?.from?.year || '';

    /* Build card element */
    const card = document.createElement('div');
    card.className = 'card';
    /* Stagger entrance animation */
    card.style.animationDelay = `${index * 0.055}s`;

    card.innerHTML = `
      <div class="card__poster">
        <img
          class="card__img loading"
          src="/load_icon.gif"
          alt="${escHtml(title)}"
          loading="lazy"
        />
        ${badgeMarkup(anime.rank ?? null)}
        <div class="card__overlay">
          ${score ? `<span class="card__score">⭐ ${score}</span>` : '<span></span>'}
          ${eps   ? `<span class="card__eps">${eps} eps</span>`    : ''}
        </div>
      </div>
      <div class="card__body">
        <a href="/title/${slug}/" class="card__title">${escHtml(title)}</a>
        <div class="card__meta">
          ${genre ? `<span class="card__genre">${escHtml(genre)}</span>` : ''}
          ${year  ? `<span class="card__year">${year}</span>`            : ''}
        </div>
      </div>
    `;

    /* Lazy-load: swap placeholder gif → real poster once preloaded */
    if (imgSrc) {
        const imgEl   = card.querySelector('.card__img');
        const preload = new Image();

        preload.onload = () => {
            if (imgEl) {
                imgEl.src = imgSrc;
                imgEl.classList.remove('loading');
            }
        };
        /* On error: keep the placeholder gif — no broken-image icon */
        preload.onerror = () => { /* intentional no-op */ };
        preload.src = imgSrc;
    }

    return card;
}


/* ════════════════════════════════════════════════════════════════
   10. GRID RENDERER
================================================================ */
function renderGrid(container, list) {
    if (!container) return;

    /* Clear skeleton placeholders */
    container.innerHTML = '';

    if (!list.length) {
        const msg = document.createElement('p');
        msg.textContent = 'Could not load titles right now — please try again later.';
        msg.style.cssText =
            'color:var(--c-sub);padding:24px 0;grid-column:1/-1;font-size:.9rem;';
        container.appendChild(msg);
        return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((anime, i) => frag.appendChild(buildCard(anime, i)));
    container.appendChild(frag);
}


/* ════════════════════════════════════════════════════════════════
   11. HELPERS
================================================================ */
function escHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;');
}


/* ════════════════════════════════════════════════════════════════
   12. BOOTSTRAP
================================================================ */
async function init() {
    /* Auth runs in the background — does not block card rendering */
    initAuth();

    /* Fetch both grids in parallel to minimise wait time.
       popular  → currently airing (trending this season)
       classics → all-time highest rated                     */
    const [popular, classics] = await Promise.all([
        fetchAnime('/top/anime?filter=airing&limit=10'),
        fetchAnime('/top/anime?limit=10'),
    ]);

    renderGrid(popularGrid,  popular);
    renderGrid(classicsGrid, classics);
}

init();
