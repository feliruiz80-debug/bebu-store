import { AppState, findPromo } from '../state.js';
import { el, showSection } from '../lib/dom.js';
import { escapeHtml, escapeAttr, idsMatch, fmt } from '../lib/format.js';
import { FALLBACKS, HOME_SECTIONS } from '../config.js';
import { linePrice } from '../lib/sheet.js';

export function getSectionById(id) {
  return HOME_SECTIONS.find((s) => s.id === id) || null;
}

export function productsForSection(section = getSectionById(AppState.currentSeccion)) {
  if (!section) return AppState.products;
  return AppState.products.filter((p) => {
    if (section.marcas?.length && !section.marcas.includes(p.marca)) return false;
    if (section.matchSubcat && !section.matchSubcat.test(p.subcategoria || '')) return false;
    if (section.excludeSubcat?.test(p.subcategoria || '')) return false;
    return true;
  });
}

function sectionMotifHtml(motif, uid = 'm') {
  if (motif === 'panales') {
    return `
      <span class="motif-item motif-item--1 motif-illu motif-illu--diaper">
        <svg viewBox="0 0 80 72" fill="none" aria-hidden="true">
          <ellipse cx="40" cy="58" rx="22" ry="6" fill="currentColor" opacity=".12"/>
          <path d="M14 22c0-8 8-14 18-14h16c10 0 18 6 18 14v10c0 14-12 26-26 26S14 46 14 32V22z" fill="url(#${uid}-d1)"/>
          <path d="M20 20c2-6 10-10 20-10s18 4 20 10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>
          <path d="M22 26h36c2 0 3.2 1.8 2.6 3.6l-3.4 10.4c-1.4 4.2-5.4 7-9.8 7H32.6c-4.4 0-8.4-2.8-9.8-7L19.4 29.6C18.8 27.8 20 26 22 26z" fill="#fff" opacity=".92"/>
          <path d="M28 36h24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".35"/>
          <circle cx="30" cy="40" r="2.6" fill="currentColor"/>
          <circle cx="50" cy="40" r="2.6" fill="currentColor"/>
          <path d="M34 46c2.2 2.4 9.8 2.4 12 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".45"/>
          <defs><linearGradient id="${uid}-d1" x1="14" y1="8" x2="66" y2="62"><stop stop-color="#fff"/><stop offset=".55" stop-color="#f4fbff"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
        </svg>
      </span>
      <span class="motif-item motif-item--2 motif-illu motif-illu--diaper">
        <svg viewBox="0 0 80 72" fill="none" aria-hidden="true">
          <path d="M18 20c0-7 7-12 16-12h12c9 0 16 5 16 12v10c0 12-10 22-22 22S18 42 18 30V20z" fill="url(#${uid}-d2)"/>
          <path d="M24 24h32c1.6 0 2.6 1.5 2.1 3l-2.8 8.4c-1.1 3.4-4.3 5.6-7.9 5.6H32.6c-3.6 0-6.8-2.2-7.9-5.6L22 27c-.5-1.5.5-3 2.1-3z" fill="#fff" opacity=".9"/>
          <circle cx="32" cy="34" r="2" fill="currentColor"/><circle cx="48" cy="34" r="2" fill="currentColor"/>
          <defs><linearGradient id="${uid}-d2" x1="18" y1="8" x2="62" y2="54"><stop stop-color="#fff"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
        </svg>
      </span>
      <span class="motif-item motif-item--3 motif-illu motif-illu--stars">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M32 8l3.2 9.8H46l-8.4 6.1 3.2 9.8L32 27.6 23.2 33.7l3.2-9.8L18 17.8h10.8L32 8z" fill="currentColor" opacity=".55"/>
          <circle cx="14" cy="42" r="3.2" fill="#fff"/><circle cx="50" cy="46" r="2.4" fill="#fff" opacity=".85"/>
          <circle cx="44" cy="18" r="2" fill="#fff" opacity=".7"/>
        </svg>
      </span>`;
  }

  if (motif === 'algodones') {
    return `
      <span class="motif-item motif-item--1 motif-illu motif-illu--cotton">
        <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
          <ellipse cx="36" cy="64" rx="14" ry="4" fill="currentColor" opacity=".12"/>
          <circle cx="36" cy="28" r="15" fill="#fff"/>
          <circle cx="24" cy="36" r="12" fill="#fff"/>
          <circle cx="48" cy="36" r="12" fill="#fff"/>
          <circle cx="30" cy="44" r="11" fill="#fff"/>
          <circle cx="42" cy="44" r="11" fill="url(#${uid}-c1)"/>
          <circle cx="36" cy="34" r="5" fill="currentColor" opacity=".18"/>
          <path d="M33 50v14M39 50v14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
          <path d="M30 58h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".45"/>
          <defs><radialGradient id="${uid}-c1" cx=".35" cy=".28" r=".8"><stop stop-color="#fff"/><stop offset="1" stop-color="currentColor"/></radialGradient></defs>
        </svg>
      </span>
      <span class="motif-item motif-item--2 motif-illu motif-illu--drop">
        <svg viewBox="0 0 52 72" fill="none" aria-hidden="true">
          <path d="M26 6c12 16 20 28 20 38a20 20 0 1 1-40 0c0-10 8-22 20-38z" fill="url(#${uid}-o1)"/>
          <ellipse cx="20" cy="40" rx="6" ry="10" fill="#fff" opacity=".42"/>
          <circle cx="30" cy="50" r="3" fill="#fff" opacity=".35"/>
          <defs><linearGradient id="${uid}-o1" x1="14" y1="8" x2="40" y2="64"><stop stop-color="#fff7e8"/><stop offset=".45" stop-color="#ffe0b0"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
        </svg>
      </span>
      <span class="motif-item motif-item--3 motif-illu motif-illu--cotton">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="26" r="11" fill="#fff"/>
          <circle cx="22" cy="32" r="9" fill="#fff"/>
          <circle cx="42" cy="32" r="9" fill="#fff"/>
          <circle cx="32" cy="38" r="9" fill="url(#${uid}-c2)"/>
          <path d="M29 44v10M35 44v10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          <defs><radialGradient id="${uid}-c2" cx=".4" cy=".3" r=".85"><stop stop-color="#fff"/><stop offset="1" stop-color="currentColor"/></radialGradient></defs>
        </svg>
      </span>`;
  }

  return `
    <span class="motif-item motif-item--1 motif-illu motif-illu--wipe">
      <svg viewBox="0 0 84 64" fill="none" aria-hidden="true">
        <rect x="8" y="16" width="56" height="38" rx="10" fill="url(#${uid}-w1)" transform="rotate(-10 36 35)"/>
        <rect x="18" y="12" width="56" height="38" rx="10" fill="#fff" opacity=".96" transform="rotate(7 46 31)"/>
        <path d="M28 24h30M28 33h24M28 42h18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>
        <circle cx="66" cy="18" r="4" fill="currentColor" opacity=".35"/>
        <defs><linearGradient id="${uid}-w1" x1="8" y1="16" x2="64" y2="54"><stop stop-color="#fff"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
      </svg>
    </span>
    <span class="motif-item motif-item--2 motif-illu motif-illu--pack">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="12" y="10" width="40" height="46" rx="8" fill="url(#${uid}-p1)"/>
        <rect x="18" y="16" width="28" height="18" rx="5" fill="#fff" opacity=".85"/>
        <path d="M22 40h20M22 46h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
        <circle cx="32" cy="25" r="5" fill="currentColor" opacity=".35"/>
        <defs><linearGradient id="${uid}-p1" x1="12" y1="10" x2="52" y2="56"><stop stop-color="currentColor" stop-opacity=".55"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
      </svg>
    </span>
    <span class="motif-item motif-item--3 motif-illu motif-illu--wipe">
      <svg viewBox="0 0 72 52" fill="none" aria-hidden="true">
        <rect x="14" y="12" width="46" height="30" rx="8" fill="#fff" opacity=".95" transform="rotate(-6 37 27)"/>
        <rect x="20" y="10" width="46" height="30" rx="8" fill="url(#${uid}-w3)" transform="rotate(8 43 25)"/>
        <path d="M30 22h24" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>
        <defs><linearGradient id="${uid}-w3" x1="20" y1="10" x2="66" y2="40"><stop stop-color="#fff"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
      </svg>
    </span>`;
}

function carouselCardHtml(p) {
  const promo = findPromo(p.id);
  const pricing = linePrice(promo?.cantidad || 1, p.precio, promo);
  const price = promo ? pricing.unitPrice : p.precio;
  const img = p.imagen
    ? `<img src="${escapeAttr(p.imagen)}" alt="" loading="lazy" draggable="false" onerror="this.style.display='none'">`
    : `<div class="carousel-card-fallback">${escapeHtml((p.marca || '?')[0])}</div>`;

  return `<article class="carousel-card" data-id="${escapeAttr(p.id)}">
    <div class="carousel-card-img">${img}</div>
    <div class="carousel-card-body">
      <div class="carousel-card-brand">${escapeHtml(p.marca)}</div>
      <div class="carousel-card-name">${escapeHtml(p.descripcion)}</div>
      <div class="carousel-card-meta">
        <span class="carousel-card-price">${fmt(price)}</span>
        <button class="btn btn-add carousel-card-add" type="button" data-action="add" data-id="${escapeAttr(p.id)}">+</button>
      </div>
    </div>
  </article>`;
}

function pickFeaturedProducts(limit = 22) {
  const pools = HOME_SECTIONS.map((section) => productsForSection(section));
  const out = [];
  const seen = new Set();
  let i = 0;
  while (out.length < limit) {
    let added = false;
    for (const pool of pools) {
      if (i >= pool.length) continue;
      const p = pool[i];
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
    i += 1;
  }
  return out;
}

let homeCarouselStop = null;

function bindInfiniteCarousel(viewport, track) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AUTO_SPEED = prefersReduced ? 0 : 20; // px/s — lento y estable
  const CARD_STEP = 240; // 228 card + 12 gap
  let offset = 0;
  let loopWidth = 0;
  let raf = 0;
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startOffset = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = false;
  let prevTs = 0;

  const group = track.querySelector('.home-carousel-group');

  function measure() {
    const count = group?.children?.length || 0;
    // Width is deterministic from fixed card size — avoids reflow stutter as images load.
    loopWidth = count > 0 ? count * CARD_STEP : 0;
    if (!loopWidth && group) loopWidth = group.scrollWidth || 0;
  }

  function wrap() {
    if (loopWidth <= 0) return;
    offset = ((offset % loopWidth) + loopWidth) % loopWidth;
    if (offset > 0) offset -= loopWidth;
  }

  function paint() {
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
  }

  function frame(ts) {
    if (!prevTs) prevTs = ts;
    const dt = Math.min(24, ts - prevTs) / 1000;
    prevTs = ts;

    if (!dragging) {
      if (Math.abs(velocity) > 12) {
        offset += velocity * dt;
        velocity *= Math.pow(0.9, dt * 60);
        if (Math.abs(velocity) < 12) velocity = 0;
      } else {
        offset -= AUTO_SPEED * dt;
      }
      wrap();
      paint();
    }

    raf = requestAnimationFrame(frame);
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('button')) return;
    dragging = true;
    moved = false;
    pointerId = e.pointerId;
    try {
      viewport.setPointerCapture?.(pointerId);
    } catch {
      /* ignore */
    }
    startX = e.clientX;
    startOffset = offset;
    lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    track.classList.add('is-dragging');
  }

  function onPointerMove(e) {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    offset = startOffset + dx;
    wrap();
    paint();

    const now = performance.now();
    const dt = Math.max(8, now - lastT);
    const instant = ((e.clientX - lastX) / dt) * 1000;
    velocity = velocity * 0.7 + instant * 0.3;
    lastX = e.clientX;
    lastT = now;
  }

  function onPointerUp(e) {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    track.classList.remove('is-dragging');
    velocity = Math.max(-360, Math.min(360, velocity));
  }

  function onClickCapture(e) {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }
  }

  measure();
  paint();
  raf = requestAnimationFrame(frame);

  const onResize = () => {
    measure();
    wrap();
    paint();
  };
  window.addEventListener('resize', onResize, { passive: true });

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove, { passive: false });
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('lostpointercapture', onPointerUp);
  viewport.addEventListener('click', onClickCapture, true);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('pointermove', onPointerMove);
    viewport.removeEventListener('pointerup', onPointerUp);
    viewport.removeEventListener('pointercancel', onPointerUp);
    viewport.removeEventListener('lostpointercapture', onPointerUp);
    viewport.removeEventListener('click', onClickCapture, true);
  };
}

function renderHomeCarousels() {
  const root = el('home-carousels');
  if (!root) return;

  if (typeof homeCarouselStop === 'function') {
    homeCarouselStop();
    homeCarouselStop = null;
  }

  const list = pickFeaturedProducts(22);
  if (!list.length) {
    root.innerHTML = '';
    return;
  }

  const cards = list.map(carouselCardHtml).join('');
  root.innerHTML = `<div class="home-carousel home-carousel--featured" aria-label="Productos destacados">
    <div class="home-carousel-label">Destacados</div>
    <div class="home-carousel-viewport">
      <div class="home-carousel-track">
        <div class="home-carousel-group">${cards}</div>
        <div class="home-carousel-group" aria-hidden="true">${cards}</div>
      </div>
    </div>
  </div>`;

  const viewport = root.querySelector('.home-carousel-viewport');
  const track = root.querySelector('.home-carousel-track');
  if (viewport && track) homeCarouselStop = bindInfiniteCarousel(viewport, track);
}

export function renderHomeSections() {
  const container = el('sections-grid');
  if (!container) return;

  AppState.currentSeccion = null;
  AppState.currentMarca = null;
  AppState.sectionProductsDirect = false;

  renderHomeCarousels();

  container.innerHTML = HOME_SECTIONS.map((section) => {
    const products = productsForSection(section);
    const qty = products.length;
    const size = section.size || 'primary';
    const motif = section.motif || section.id;

    return `<button type="button" class="section-card section-card--${escapeAttr(size)}" data-section="${escapeAttr(section.id)}" style="--section-accent: ${section.accent}">
      <span class="section-motif section-motif--${escapeAttr(motif)}" aria-hidden="true">${sectionMotifHtml(motif, section.id)}</span>
      <span class="section-card-title">${escapeHtml(section.title)}</span>
      <span class="section-card-sub">${escapeHtml(section.subtitle)}</span>
      <span class="section-card-count">${qty} producto${qty !== 1 ? 's' : ''}</span>
    </button>`;
  }).join('');

  showSection('home-view');
}

export function renderBrands(sectionId = AppState.currentSeccion) {
  const container = el('brands-grid');
  if (!container) return;

  const section = getSectionById(sectionId);
  if (section) AppState.currentSeccion = section.id;

  const scoped = productsForSection(section);
  const marcasMap = {};
  scoped.forEach((p) => {
    if (!p.marca) return;
    marcasMap[p.marca] = marcasMap[p.marca] || { count: 0, logo: '' };
    marcasMap[p.marca].count++;
  });
  AppState.brands.forEach((b) => {
    if (!b.marca || !marcasMap[b.marca]) return;
    if (b.logo) marcasMap[b.marca].logo = b.logo;
  });

  const ordered = [];
  const activePromos = AppState.promos.filter((pr) => {
    if (!pr.activo || !pr.id_producto) return false;
    return scoped.some((p) => idsMatch(p.id, pr.id_producto));
  });
  if (!section && activePromos.length) ordered.push('__PROMOS__');

  const preferred = section?.marcas || [];
  preferred.forEach((m) => {
    if (marcasMap[m] && !ordered.includes(m)) ordered.push(m);
  });
  AppState.brands.forEach((b) => {
    if (b.marca && marcasMap[b.marca] && !ordered.includes(b.marca)) ordered.push(b.marca);
  });
  scoped.forEach((p) => {
    if (p.marca && marcasMap[p.marca] && !ordered.includes(p.marca)) ordered.push(p.marca);
  });

  const brandsLabel = el('brands-label');
  if (brandsLabel) brandsLabel.textContent = section ? section.title : 'Marcas';

  if (!ordered.length) {
    const err = AppState.errors.Productos;
    container.innerHTML = `<div class="empty-state"><p>${err ? 'No se pudo leer Productos. Publicá el Sheet para la web.' : 'No hay marcas en esta sección.'}</p></div>`;
    showSection('brands-view');
    return;
  }

  container.innerHTML = ordered
    .map((marca) => {
      if (marca === '__PROMOS__') {
        return `<div class="brand-card promo-card" data-marca="PROMOCIONES" data-action="promos" role="button" tabindex="0">
          <div class="brand-img"><div class="promo-badge">PROMOCIONES</div></div>
          <div class="brand-body"><div class="brand-name">Promociones</div><div class="brand-count">${activePromos.length} activa${activePromos.length !== 1 ? 's' : ''}</div></div>
        </div>`;
      }
      const { logo, count } = marcasMap[marca];
      const logoHtml = logo
        ? `<img src="${escapeAttr(logo)}" alt="${escapeHtml(marca)}" loading="lazy" onerror="this.src='${FALLBACKS.LOGO_LOCAL}'">`
        : `<div class="brand-initial">${escapeHtml(marca[0] || '?')}</div>`;
      return `<div class="brand-card" data-marca="${escapeAttr(marca)}" role="button" tabindex="0">
        <div class="brand-img">${logoHtml}</div>
        <div class="brand-body"><div class="brand-name">${escapeHtml(marca)}</div><div class="brand-count">${count} producto${count !== 1 ? 's' : ''}</div></div>
      </div>`;
    })
    .join('');

  showSection('brands-view');
}

export function renderSubcategories(marca) {
  const container = el('subcats-grid');
  const items = productsForSection().filter((p) => p.marca === marca);
  const subs = items.map((i) => i.subcategoria).filter((v, i, self) => v && self.indexOf(v) === i);
  AppState.currentMarca = marca;

  if (!subs.length) {
    container.innerHTML = `<div class="empty-state"><p>No hay líneas para ${escapeHtml(marca)}</p></div>`;
    const label = el('subcats-label');
    if (label) label.textContent = `Líneas de ${marca}`;
    showSection('subcats-view');
    return;
  }

  container.innerHTML = subs
    .map((s) => {
      const qty = items.filter((i) => i.subcategoria === s).length;
      return `<div class="subcat-card" data-sub="${escapeAttr(s)}" role="button" tabindex="0">
        <div class="subcat-name">${escapeHtml(s)}</div>
        <div class="subcat-count">${qty} producto${qty !== 1 ? 's' : ''}</div>
      </div>`;
    })
    .join('');

  const label = el('subcats-label');
  if (label) label.textContent = `Líneas de ${marca}`;
  showSection('subcats-view');
}
