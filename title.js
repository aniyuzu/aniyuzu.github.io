/* ══════════════════════════════════════════════════════════════
   AniYuzu — title.js
   Handles:
     1. URL parsing  (/title/SLUG/?ep=N)
     2. episodes.json fetch & series lookup
     3. Rendering: player · episode panel · server buttons · info
     4. Episode & server switching with history.pushState
     5. Navbar (menu, mobile search, search redirect)
══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let currentSlug   = '';
let currentEpNum  = 1;
let currentServer = 'server1';
let seriesData    = null;
let episodeData   = null;

/* ─────────────────────────────────────────────────────────────
   DOM HELPERS
───────────────────────────────────────────────────────────── */
const $  = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

/* ─────────────────────────────────────────────────────────────
   URL PARSING
───────────────────────────────────────────────────────────── */

/**
 * Extract the slug from the URL path.
 * Path pattern: /title/SLUG/  or  /title/SLUG
 */
function parseSlug() {
    const parts = window.location.pathname
        .split('/')
        .filter(Boolean); // removes empty strings from leading/trailing slashes
    // ['title', 'slug'] — index 0 = 'title', index 1 = slug
    if (parts.length >= 2 && parts[0] === 'title') {
        return parts[1];
    }
    return null;
}

/**
 * Extract the ?ep= parameter.
 * Returns a positive integer or null.
 */
function parseEp() {
    const raw = new URLSearchParams(window.location.search).get('ep');
    const n   = parseInt(raw, 10);
    return (isNaN(n) || n < 1) ? null : n;
}

/**
 * Push a new entry to the browser history without a page reload.
 */
function updateURL(epNum) {
    const url = `/title/${encodeURIComponent(currentSlug)}/?ep=${epNum}`;
    history.pushState({ slug: currentSlug, ep: epNum }, '', url);
}

/* ─────────────────────────────────────────────────────────────
   DATA FETCHING
───────────────────────────────────────────────────────────── */
async function fetchEpisodesJSON() {
    const res = await fetch('/episodes.json');
    if (!res.ok) throw new Error(`episodes.json returned HTTP ${res.status}`);
    return res.json();
}

function findSeries(data, slug) {
    return data.series.find(s => s.slug === slug) ?? null;
}

function findEpisode(series, epNum) {
    return series.episodes.find(e => e.number === epNum) ?? null;
}

/* ─────────────────────────────────────────────────────────────
   UI: SHOW / HIDE SECTIONS
───────────────────────────────────────────────────────────── */
function showLoading()  { $('titleLoading').classList.remove('hidden'); }
function hideLoading()  { $('titleLoading').classList.add('hidden');    }
function showContent()  { $('titleContent').classList.remove('hidden'); }

function showError(msg) {
    hideLoading();
    $('titleContent').classList.add('hidden');
    $('titleErrorMsg').textContent = msg;
    $('titleError').classList.remove('hidden');
}

/* ─────────────────────────────────────────────────────────────
   RENDER: PLAYER
───────────────────────────────────────────────────────────── */
function renderPlayer(episode) {
    const src = episode.sources[currentServer];
    const video = $('mainPlayer');
    if (!src || !video) return;

    // Fade out → swap src → fade in
    video.classList.add('fading');
    setTimeout(() => {
        video.src = src;
        video.load();
        video.classList.remove('fading');
    }, 180);
}

/* ─────────────────────────────────────────────────────────────
   RENDER: SERVER BUTTONS
───────────────────────────────────────────────────────────── */
function renderServerBtns(episode) {
    const container = $('serverBtns');
    if (!container) return;

    container.innerHTML = '';

    Object.keys(episode.sources).forEach((key, index) => {
        const btn = document.createElement('button');
        btn.className = 'server-btn' + (key === currentServer ? ' active' : '');
        btn.dataset.server = key;
        btn.setAttribute('aria-pressed', key === currentServer ? 'true' : 'false');
        btn.innerHTML = `
            <span class="material-symbols-rounded">dns</span>
            Server ${index + 1}
        `;

        btn.addEventListener('click', () => {
            if (key === currentServer) return; // already active
            currentServer = key;
            // Update aria-pressed on all buttons
            $$('.server-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.server === key);
                b.setAttribute('aria-pressed', b.dataset.server === key ? 'true' : 'false');
            });
            renderPlayer(episodeData);
        });

        container.appendChild(btn);
    });
}

/* ─────────────────────────────────────────────────────────────
   RENDER: EPISODE GRID
───────────────────────────────────────────────────────────── */
function renderEpGrid(series, activeEpNum) {
    const grid = $('epGrid');
    if (!grid) return;

    grid.innerHTML = '';

    series.episodes.forEach(ep => {
        const tile = document.createElement('button');
        tile.className = 'ep-tile' + (ep.number === activeEpNum ? ' active' : '');
        tile.dataset.ep = ep.number;
        tile.setAttribute('aria-pressed', ep.number === activeEpNum ? 'true' : 'false');
        tile.title = `Episode ${ep.number}: ${ep.title}`;
        tile.innerHTML = `
            <span class="ep-tile__num">${ep.number}</span>
            <span class="ep-tile__title">${escHtml(ep.title)}</span>
        `;

        tile.addEventListener('click', () => {
            if (ep.number === currentEpNum) return; // already active
            changeEpisode(ep.number);
        });

        grid.appendChild(tile);
    });

    // Counter badge
    const count = $('epPanelCount');
    if (count) count.textContent = `${series.episodes.length} eps`;

    scrollActiveTileIntoView();
}

function scrollActiveTileIntoView() {
    const grid = $('epGrid');
    const tile = grid?.querySelector('.ep-tile.active');
    if (tile) tile.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

/* ─────────────────────────────────────────────────────────────
   RENDER: SERIES + EPISODE INFO
───────────────────────────────────────────────────────────── */
function renderInfo(series, episode) {
    const info = $('titleInfo');
    if (!info) return;

    const statusClass = series.status === 'Completed' ? 'meta-badge--completed' : 'meta-badge--ongoing';
    const scoreBlock  = typeof series.score === 'number'
        ? `<div class="title-info__score">
               <span class="score-star">⭐</span>
               <span class="score-num">${series.score.toFixed(1)}</span>
               <span class="score-lbl">/ 10</span>
           </div>`
        : '';

    info.innerHTML = `
        <span class="now-playing-label">
            <span class="material-symbols-rounded">play_circle</span>
            Now Playing
        </span>

        <h1 class="title-info__name">${escHtml(series.title)}</h1>
        <p class="title-info__ep-title">Episode ${episode.number}: ${escHtml(episode.title)}</p>

        <div class="title-info__meta">
            <span class="meta-badge meta-badge--age">${escHtml(series.ageRating)}</span>
            <span class="meta-badge ${statusClass}">${escHtml(series.status)}</span>
            <span class="meta-badge meta-badge--info">${series.seasons} Season${series.seasons !== 1 ? 's' : ''}</span>
            <span class="meta-badge meta-badge--info">${series.episodeCount} Episodes</span>
        </div>

        <div class="title-info__genres">
            ${series.genres.map(g => `<span class="genre-tag">${escHtml(g)}</span>`).join('')}
        </div>

        <div class="title-info__divider"></div>

        <p class="title-info__desc">${escHtml(series.description)}</p>

        ${scoreBlock}
    `;

    // Update browser tab title
    document.title = `${series.title} — Ep. ${episode.number} | AniYuzu`;
}

/* ─────────────────────────────────────────────────────────────
   RENDER: PREV / NEXT NAV BAR
───────────────────────────────────────────────────────────── */
function renderEpNav() {
    const episodes = seriesData.episodes;
    const idx      = episodes.findIndex(e => e.number === currentEpNum);
    const label    = $('epNavLabel');
    const prevBtn  = $('prevEpBtn');
    const nextBtn  = $('nextEpBtn');

    if (label)   label.textContent = `Episode ${currentEpNum}`;
    if (prevBtn) prevBtn.disabled  = idx <= 0;
    if (nextBtn) nextBtn.disabled  = idx >= episodes.length - 1;
}

/* ─────────────────────────────────────────────────────────────
   CHANGE EPISODE  (main interaction handler)
───────────────────────────────────────────────────────────── */
function changeEpisode(epNum) {
    const ep = findEpisode(seriesData, epNum);
    if (!ep) return;

    currentEpNum = epNum;
    episodeData  = ep;

    // 1. Update browser URL (no reload)
    updateURL(epNum);

    // 2. Swap video source
    renderPlayer(ep);

    // 3. Re-render server buttons (same server key, different sources)
    renderServerBtns(ep);

    // 4. Update active tile
    $$('.ep-tile').forEach(tile => {
        const isActive = parseInt(tile.dataset.ep, 10) === epNum;
        tile.classList.toggle('active', isActive);
        tile.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    scrollActiveTileIntoView();

    // 5. Update prev/next nav
    renderEpNav();

    // 6. Update info block
    renderInfo(seriesData, ep);
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function escHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;');
}

/* ─────────────────────────────────────────────────────────────
   NAVBAR  (identical logic to script.js, self-contained)
───────────────────────────────────────────────────────────── */
function initNavbar() {
    const navbar           = $('navbar');
    const menuBtn          = $('menuBtn');
    const menuIcon         = $('menuIcon');
    const closeBtn         = $('closeBtn');
    const sidemenu         = $('sidemenu');
    const backdrop         = $('backdrop');
    const searchForm       = $('searchForm');
    const searchInput      = $('searchInput');
    const mobileSearchBtn  = $('mobileSearchBtn');
    const mobileSearch     = $('mobileSearch');
    const mobileSearchForm = $('mobileSearchForm');
    const mobileSearchInput= $('mobileSearchInput');

    // Scroll shadow
    window.addEventListener('scroll', () => {
        navbar?.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    // Side menu
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

    // Mobile search
    function openMobileSearch() {
        mobileSearch?.classList.add('open');
        mobileSearch?.setAttribute('aria-hidden', 'false');
        setTimeout(() => mobileSearchInput?.focus(), 60);
    }
    function closeMobileSearch() {
        mobileSearch?.classList.remove('open');
        mobileSearch?.setAttribute('aria-hidden', 'true');
    }

    mobileSearchBtn?.addEventListener('click', () => {
        mobileSearch?.classList.contains('open') ? closeMobileSearch() : openMobileSearch();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeMenu();
        closeMobileSearch();
    });

    // Search redirect → /search?title=
    function doSearch(input) {
        const q = input?.value.trim();
        if (!q) { input?.focus(); return; }
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
}

/* ─────────────────────────────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────────────────────────────── */
async function init() {
    // Navbar (independent of data loading)
    initNavbar();

    // 1. Parse slug from path
    currentSlug = parseSlug();
    if (!currentSlug) {
        showError('Invalid URL — no series slug detected in the address.');
        return;
    }

    // 2. If ?ep= is missing, redirect to ?ep=1
    const epParam = parseEp();
    if (epParam === null) {
        window.location.replace(`/title/${encodeURIComponent(currentSlug)}/?ep=1`);
        return;
    }
    currentEpNum = epParam;

    // 3. Show loading skeleton
    showLoading();

    // 4. Fetch data
    let data;
    try {
        data = await fetchEpisodesJSON();
    } catch (err) {
        console.error('[AniYuzu] Could not load episodes.json:', err);
        showError('Could not load episode data. Please try again later.');
        return;
    }

    // 5. Find series by slug
    seriesData = findSeries(data, currentSlug);
    if (!seriesData) {
        showError(`The series "${currentSlug}" was not found in the AniYuzu library.`);
        return;
    }

    // 6. Find requested episode; fall back to first episode if not found
    episodeData = findEpisode(seriesData, currentEpNum);
    if (!episodeData) {
        console.warn(`[AniYuzu] Episode ${currentEpNum} not found — falling back to episode 1.`);
        episodeData  = seriesData.episodes[0];
        currentEpNum = episodeData.number;
        updateURL(currentEpNum);
    }

    // 7. Reveal content, hide skeleton
    hideLoading();
    showContent();

    // 8. Render all sections
    renderPlayer(episodeData);
    renderServerBtns(episodeData);
    renderEpGrid(seriesData, currentEpNum);
    renderInfo(seriesData, episodeData);
    renderEpNav();

    // 9. Wire prev / next buttons
    $('prevEpBtn')?.addEventListener('click', () => {
        const eps = seriesData.episodes;
        const idx = eps.findIndex(e => e.number === currentEpNum);
        if (idx > 0) changeEpisode(eps[idx - 1].number);
    });

    $('nextEpBtn')?.addEventListener('click', () => {
        const eps = seriesData.episodes;
        const idx = eps.findIndex(e => e.number === currentEpNum);
        if (idx < eps.length - 1) changeEpisode(eps[idx + 1].number);
    });

    // 10. Browser Back / Forward support
    window.addEventListener('popstate', () => {
        const ep = parseEp();
        if (ep !== null && ep !== currentEpNum) {
            changeEpisode(ep);
        }
    });
}

init();
