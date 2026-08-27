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
    if (section.matchSubcat) return section.matchSubcat.test(p.subcategoria || '');
    if (section.marcas?.length && !section.marcas.includes(p.marca)) return false;
    if (section.excludeSubcat?.test(p.subcategoria || '')) return false;
    return true;
  });
}

/** Pick up to 3 distinct product photos for the floating home motifs. */
export function motifProductsForSection(section, limit = 3) {
  const withImg = productsForSection(section).filter((p) => p.imagen);
  if (!withImg.length) return [];

  const picked = [];
  const seenUrl = new Set();
  const seenMarca = new Set();

  // Prefer brand diversity first (e.g. Pampers + Huggies + Babysec on Pañales).
  for (const p of withImg) {
    if (picked.length >= limit) break;
    const url = p.imagen;
    if (seenUrl.has(url) || seenMarca.has(p.marca)) continue;
    seenUrl.add(url);
    seenMarca.add(p.marca);
    picked.push(p);
  }

  for (const p of withImg) {
    if (picked.length >= limit) break;
    if (seenUrl.has(p.imagen)) continue;
    seenUrl.add(p.imagen);
    picked.push(p);
  }

  return picked;
}

function carouselCardHtml(p) {
  const promo = findPromo(p.id);
  const pricing = linePrice(promo?.cantidad || 1, p.precio, promo);
  const price = promo ? pricing.unitPrice : p.precio;
  const img = p.imagen
    ? `<img src="${escapeAttr(p.imagen)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="carousel-card-fallback">${escapeHtml((p.marca || '?')[0])}</div>`;

  return `<article class="carousel-card" data-id="${escapeAttr(p.id)}">
    <div class="carousel-card-img">${img}</div>
    <div class="carousel-card-body">
      <div class="carousel-card-name">${escapeHtml(p.descripcion)}</div>
      <div class="carousel-card-meta">
        <span class="carousel-card-price">${fmt(price)}</span>
        <button class="btn btn-add carousel-card-add" type="button" data-action="add" data-id="${escapeAttr(p.id)}">+</button>
      </div>
    </div>
  </article>`;
}

function renderHomeCarousels() {
  const root = el('home-carousels');
  if (!root) return;

  root.innerHTML = HOME_SECTIONS.map((section) => {
    const list = productsForSection(section).slice(0, 14);
    if (!list.length) return '';
    const cards = list.map(carouselCardHtml).join('');
    const seconds = Math.max(28, list.length * 3.2);
    return `<div class="home-carousel" data-section="${escapeAttr(section.id)}" style="--carousel-duration: ${seconds}s; --section-accent: ${section.accent}">
      <div class="home-carousel-label">${escapeHtml(section.title)}</div>
      <div class="home-carousel-viewport">
        <div class="home-carousel-track">
          <div class="home-carousel-group">${cards}</div>
          <div class="home-carousel-group" aria-hidden="true">${cards}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  root.querySelectorAll('.home-carousel-viewport').forEach((viewport) => {
    const track = viewport.querySelector('.home-carousel-track');
    if (!track) return;
    const pause = () => track.classList.add('is-paused');
    const resume = () => track.classList.remove('is-paused');
    viewport.addEventListener('pointerdown', pause);
    viewport.addEventListener('pointerup', resume);
    viewport.addEventListener('pointerleave', resume);
    viewport.addEventListener('touchstart', pause, { passive: true });
    viewport.addEventListener('touchend', resume, { passive: true });
  });
}

export function renderHomeSections() {
  const container = el('sections-grid');
  if (!container) return;

  AppState.currentSeccion = null;
  AppState.currentMarca = null;

  renderHomeCarousels();

  container.innerHTML = HOME_SECTIONS.map((section) => {
    const products = productsForSection(section);
    const qty = products.length;
    const size = section.size || 'primary';
    const motif = section.motif || section.id;
    const motifs = motifProductsForSection(section, 3);
    const motifHtml = motifs.length
      ? motifs
          .map(
            (p, i) =>
              `<span class="motif-item motif-item--${i + 1}">
                <img src="${escapeAttr(p.imagen)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.closest('.motif-item')?.remove()">
              </span>`
          )
          .join('')
      : '';

    return `<button type="button" class="section-card section-card--${escapeAttr(size)}" data-section="${escapeAttr(section.id)}" style="--section-accent: ${section.accent}">
      <span class="section-motif section-motif--${escapeAttr(motif)}" aria-hidden="true">${motifHtml}</span>
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
