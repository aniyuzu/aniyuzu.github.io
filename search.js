'use strict';

/* ════════════════════════════════════════════════════
   AniYuzu — search.js
   Reads ?title= from URL, fetches /episodes.json,
   filters and renders matching cards.
════════════════════════════════════════════════════ */

const g   = id => document.getElementById(id);
const esc = s  => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

/* ─── Navbar ─────────────────────────────────────── */
function initNavbar() {
    const navbar   = g('navbar');
    const menuBtn  = g('menuBtn');
    const menuIcon = g('menuIcon');
    const closeBtn = g('closeBtn');
    const sidemenu = g('sidemenu');
    const backdrop = g('backdrop');
    const mSBtn    = g('mobileSearchBtn');
    const mSearch  = g('mobileSearch');
    const mSInput  = g('mobileSearchInput');

    window.addEventListener('scroll', () =>
        navbar?.classList.toggle('scrolled', window.scrollY > 8), { passive: true });

    const openMenu = () => {
        sidemenu?.classList.add('open');
        sidemenu?.setAttribute('aria-hidden', 'false');
        backdrop?.classList.add('active');
        menuBtn?.setAttribute('aria-expanded', 'true');
        if (menuIcon) menuIcon.textContent = 'close';
        document.body.style.overflow = 'hidden';
    };
    const closeMenu = () => {
        sidemenu?.classList.remove('open');
        sidemenu?.setAttribute('aria-hidden', 'true');
        backdrop?.classList.remove('active');
        menuBtn?.setAttribute('aria-expanded', 'false');
        if (menuIcon) menuIcon.textContent = 'menu';
        document.body.style.overflow = '';
    };
    const openMS = () => {
        mSearch?.classList.add('open');
        mSearch?.setAttribute('aria-hidden', 'false');
        setTimeout(() => mSInput?.focus(), 60);
    };
    const closeMS = () => {
        mSearch?.classList.remove('open');
        mSearch?.setAttribute('aria-hidden', 'true');
    };

    menuBtn?.addEventListener('click', openMenu);
    closeBtn?.addEventListener('click', closeMenu);
    backdrop?.addEventListener('click', closeMenu);
    mSBtn?.addEventListener('click', () =>
        mSearch?.classList.contains('open') ? closeMS() : openMS());
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeMenu(); closeMS(); }
    });

    const redirect = q => {
        if (q?.trim()) window.location.href = `/search?title=${encodeURIComponent(q.trim())}`;
    };
    g('searchForm')?.addEventListener('submit', e => {
        e.preventDefault(); redirect(g('searchInput')?.value);
    });
    g('mobileSearchForm')?.addEventListener('submit', e => {
        e.preventDefault(); redirect(g('mobileSearchInput')?.value);
    });
}

/* ─── Build card from episodes.json series object ── */
function buildCard(series, index) {
    const href  = `/title/${encodeURIComponent(series.slug)}/?ep=1`;
    const genre = series.genres?.[0] || '';
    const eps   = series.episodeCount || series.episodes?.length;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${index * 0.055}s`;
    card.style.cursor = 'pointer';

    card.innerHTML = `
        <div class="card__poster">
            <img class="card__img loading" src="/load_icon.gif" alt="${esc(series.title)}" loading="lazy">
            ${series.ageRating ? `<span class="card__badge card__badge--new">${esc(series.ageRating)}</span>` : ''}
            <div class="card__overlay">
                ${series.score ? `<span class="card__score">⭐ ${series.score}</span>` : '<span></span>'}
                ${eps ? `<span class="card__eps">${eps} eps</span>` : ''}
            </div>
        </div>
        <div class="card__body">
            <a href="${href}" class="card__title">${esc(series.title)}</a>
            <div class="card__meta">
                ${genre       ? `<span class="card__genre">${esc(genre)}</span>` : ''}
                ${series.year ? `<span class="card__year">${series.year}</span>` : ''}
            </div>
        </div>`;

    if (series.posterUrl) {
        const img = card.querySelector('.card__img');
        const pl  = new Image();
        pl.onload  = () => { img.src = series.posterUrl; img.classList.remove('loading'); };
        pl.onerror = () => {};
        pl.src     = series.posterUrl;
    }

    card.addEventListener('click', e => {
        if (e.target.tagName !== 'A') window.location.href = href;
    });

    return card;
}

/* ─── Filter series array ────────────────────────── */
function filterSeries(all, q) {
    if (!q) return [];
    const lq = q.toLowerCase();
    return all.filter(s =>
        s.title.toLowerCase().includes(lq) ||
        (s.genres      || []).some(genre => genre.toLowerCase().includes(lq)) ||
        (s.description || '').toLowerCase().includes(lq)
    );
}

/* ─── Render results into #searchGrid ────────────── */
function renderResults(list, q) {
    const grid  = g('searchGrid');
    const count = g('searchCount');
    const noRes = g('noResults');
    const msg   = g('noResultsMsg');

    if (!grid) return;
    grid.innerHTML = '';

    if (!list.length) {
        if (noRes) noRes.classList.remove('hidden');
        if (msg)   msg.textContent = `No anime found for "${q}". Try a different title or keyword.`;
        if (count) count.textContent = '0 results';
        return;
    }

    if (noRes) noRes.classList.add('hidden');
    if (count) count.textContent = `${list.length} result${list.length !== 1 ? 's' : ''}`;

    const frag = document.createDocumentFragment();
    list.forEach((s, i) => frag.appendChild(buildCard(s, i)));
    grid.appendChild(frag);
}

/* ─── Bootstrap ──────────────────────────────────── */
async function init() {
    initNavbar();

    const query   = new URLSearchParams(window.location.search).get('title')?.trim() || '';
    const display = g('searchQueryDisplay');
    const subline = g('searchSubline');
    const count   = g('searchCount');

    document.title = query ? `"${query}" — Search | AniYuzu` : 'Search | AniYuzu';

    /* Pre-fill every search input with the current query */
    ['searchInput', 'mobileSearchInput', 'heroSearchInput'].forEach(id => {
        const el = g(id);
        if (el) el.value = query;
    });

    if (display) display.textContent = query ? `"${query}"` : '…';

    /* Wire the hero search form inside the search page */
    g('heroSearchForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const q = g('heroSearchInput')?.value?.trim();
        if (q) window.location.href = `/search?title=${encodeURIComponent(q)}`;
    });

    /* ── No query entered ── */
    if (!query) {
        const grid = g('searchGrid');
        if (grid) grid.innerHTML = '';
        if (subline) subline.textContent = 'Enter a title above to search.';
        if (count)   count.textContent   = '';
        const noRes = g('noResults');
        if (noRes) {
            noRes.classList.remove('hidden');
            const noMsg = g('noResultsMsg');
            if (noMsg) noMsg.textContent = 'Use the search bar to discover anime in our library.';
        }
        return;
    }

    if (subline) subline.textContent = `Searching for "${query}"…`;

    try {
        const res = await fetch('/episodes.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data    = await res.json();
        const results = filterSeries(data.series || [], query);

        if (subline) {
            subline.textContent = results.length
                ? `${results.length} title${results.length !== 1 ? 's' : ''} found`
                : `No results for "${query}"`;
        }

        renderResults(results, query);
    } catch (err) {
        console.error('[AniYuzu] search.js:', err);
        const grid = g('searchGrid');
        if (grid) grid.innerHTML = '';
        g('searchError')?.classList.remove('hidden');
        if (subline) subline.textContent = 'Search failed. Please try again later.';
    }
}

init();
