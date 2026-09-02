import { AppState } from '../state.js';
import { el, showSection, openOverlay, closeOverlay, setBottomNav } from '../lib/dom.js';
import { escapeHtml, idsMatch } from '../lib/format.js';
import { productCardHtml } from './products.js';
import { productsForSection, getSectionById } from './brands.js';
import { getOfferCardItems, offerPromoListHtml } from './offer.js';

function isSearchOpen() {
  return el('modal-buscar')?.classList.contains('is-open');
}

export function openSearchModal({ focus = true, query } = {}) {
  const modal = el('modal-buscar');
  if (!modal) return;
  openOverlay(modal);
  setBottomNav('search');
  const input = el('buscador');
  if (typeof query === 'string' && input) input.value = query;
  if (!String(input?.value || '').trim()) renderSearchResults([], '');
  if (focus) setTimeout(() => input?.focus(), 220);
}

export function closeSearchModal() {
  closeOverlay(el('modal-buscar'));
  if (
    !el('modal-carrito')?.classList.contains('is-open') &&
    !el('modal-promos')?.classList.contains('is-open')
  ) {
    setBottomNav('home');
  }
}

export function openPromosModal() {
  const modal = el('modal-promos');
  if (!modal) return;
  renderPromotions();
  openOverlay(modal);
  setBottomNav('promos');
}

export function closePromosModal() {
  closeOverlay(el('modal-promos'));
  if (
    !el('modal-carrito')?.classList.contains('is-open') &&
    !el('modal-buscar')?.classList.contains('is-open')
  ) {
    setBottomNav('home');
  }
}

const SIZE_RANK = {
  RN: 1,
  'RN+': 2,
  NB: 1,
  P: 3,
  M: 4,
  G: 5,
  XG: 6,
  XXG: 7,
  XXXG: 8,
  XXXXG: 9
};

function rankSubcat(name) {
  const key = String(name || '').trim().toUpperCase();
  if (SIZE_RANK[key] != null) return SIZE_RANK[key];
  const token = key.split(/[\s/-]+/)[0];
  if (SIZE_RANK[token] != null) return SIZE_RANK[token];
  return 1000;
}

function groupProductsBySubcat(list) {
  const groups = new Map();
  list.forEach((p) => {
    const key = p.subcategoria || 'General';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  return [...groups.entries()].sort((a, b) => {
    const ra = rankSubcat(a[0]);
    const rb = rankSubcat(b[0]);
    if (ra !== rb) return ra - rb;
    return String(a[0]).localeCompare(String(b[0]), 'es');
  });
}

function productsGroupedHtml(list, { hideSubcat = false } = {}) {
  const groups = groupProductsBySubcat(list);
  if (groups.length <= 1) {
    return list.map((p) => productCardHtml(p, { hideSubcat: false })).join('');
  }
  return groups
    .map(([subcat, items]) => {
      const qty = items.length;
      return `<section class="product-group" aria-label="${escapeHtml(subcat)}">
        <h2 class="product-group-title">
          <span>${escapeHtml(subcat)}</span>
          <span class="product-group-count">${qty} producto${qty !== 1 ? 's' : ''}</span>
        </h2>
        <div class="product-group-grid">${items.map((p) => productCardHtml(p, { hideSubcat })).join('')}</div>
      </section>`;
    })
    .join('');
}

export function renderProducts(marca, subcat) {
  AppState.sectionProductsDirect = false;
  const container = el('products-grid');
  const list = productsForSection().filter((p) => p.marca === marca && p.subcategoria === subcat);
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><p>Sin productos</p></div>`;
  } else {
    container.innerHTML = list.map(productCardHtml).join('');
  }
  const label = el('products-label');
  if (label) label.textContent = `${subcat} · ${list.length} producto${list.length !== 1 ? 's' : ''}`;
  showSection('products-view');
}

export function renderBrandProducts(marca) {
  AppState.sectionProductsDirect = false;
  AppState.currentMarca = marca;

  const container = el('products-grid');
  const list = productsForSection().filter((p) => p.marca === marca);
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><p>Sin productos</p></div>`;
  } else {
    container.innerHTML = productsGroupedHtml(list, { hideSubcat: true });
  }
  const label = el('products-label');
  if (label) {
    label.textContent = `${marca} · ${list.length} producto${list.length !== 1 ? 's' : ''}`;
  }
  showSection('products-view');
}

export function renderSectionProducts(sectionId) {
  const section = getSectionById(sectionId);
  AppState.currentSeccion = sectionId;
  AppState.currentMarca = null;
  AppState.sectionProductsDirect = true;

  const container = el('products-grid');
  const list = productsForSection(section);
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><p>Sin productos</p></div>`;
  } else {
    container.innerHTML = list.map(productCardHtml).join('');
  }
  const label = el('products-label');
  if (label) {
    const title = section?.title || 'Productos';
    label.textContent = `${title} · ${list.length} producto${list.length !== 1 ? 's' : ''}`;
  }
  showSection('products-view');
}

export function renderPromotions() {
  const results = [];
  const seen = new Set();
  AppState.promos
    .filter((pr) => pr.activo && pr.id_producto)
    .forEach((pr) => {
      const prod = AppState.products.find((p) => idsMatch(p.id, pr.id_producto));
      if (!prod || seen.has(prod.id)) return;
      seen.add(prod.id);
      results.push(prod);
    });

  const container = el('promos-grid');
  const label = el('promos-count-label');
  if (!container) return;

  const combo = offerPromoListHtml(getOfferCardItems());
  if (!results.length && !combo) {
    container.innerHTML = `<div class="empty-state"><p>No hay promociones activas</p></div>`;
    if (label) label.textContent = 'Sin promociones';
    return;
  }

  container.innerHTML = `${combo}${results.map(productCardHtml).join('')}`;
  if (label) {
    const n = results.length + (combo ? 1 : 0);
    label.textContent = `${n} promo${n !== 1 ? 's' : ''} activa${n !== 1 ? 's' : ''}`;
  }
}

export function renderSearchResults(results, query) {
  const container = el('search-grid');
  if (!container) return;
  const label = el('search-count-label');
  const q = String(query || '').trim();

  if (!q) {
    container.innerHTML = `<div class="empty-state"><p>Buscá por producto, marca o línea</p></div>`;
    if (label) label.textContent = 'Escribí para buscar';
    return;
  }

  if (!results.length) {
    container.innerHTML = `<div class="empty-state"><p>Sin resultados para “${escapeHtml(q)}”</p></div>`;
    if (label) label.textContent = 'Sin resultados';
    return;
  }

  container.innerHTML = results.map(productCardHtml).join('');
  if (label) {
    label.textContent =
      q === 'Promociones'
        ? 'Promociones activas'
        : `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
  }
  if (!isSearchOpen()) openSearchModal({ focus: false });
}

export function handleSearchInput(value) {
  const q = String(value || '').trim().toLowerCase();
  if (!q) {
    renderSearchResults([], '');
    return;
  }
  const resultados = AppState.products.filter(
    (p) =>
      p.descripcion.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q) ||
      p.subcategoria.toLowerCase().includes(q)
  );
  renderSearchResults(resultados, value);
}
