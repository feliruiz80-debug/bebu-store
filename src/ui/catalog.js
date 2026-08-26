import { AppState } from '../state.js';
import { el, showSection } from '../lib/dom.js';
import { escapeHtml, idsMatch } from '../lib/format.js';
import { productCardHtml } from './products.js';
import { renderBrands } from './brands.js';

export function renderProducts(marca, subcat) {
  const container = el('products-grid');
  const list = AppState.products.filter((p) => p.marca === marca && p.subcategoria === subcat);
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><p>Sin productos</p></div>`;
    showSection('products-view');
    return;
  }
  container.innerHTML = list.map(productCardHtml).join('');
  const label = el('products-label');
  if (label) label.textContent = `${subcat} · ${list.length} producto${list.length !== 1 ? 's' : ''}`;
  showSection('products-view');
}

export function renderPromotions() {
  const results = [];
  AppState.promos
    .filter((pr) => pr.activo && pr.id_producto)
    .forEach((pr) => {
      const prod = AppState.products.find((p) => idsMatch(p.id, pr.id_producto));
      if (prod) results.push(prod);
    });
  renderSearchResults(results, 'Promociones');
}

export function renderSearchResults(results, query) {
  const container = el('search-grid');
  if (!container) return;
  if (!results.length) {
    container.innerHTML = `<div class="empty-state"><p>Sin resultados para “${escapeHtml(query)}”</p></div>`;
    showSection('search-view');
    return;
  }
  container.innerHTML = results.map(productCardHtml).join('');
  const label = el('search-count-label');
  if (label) {
    label.textContent =
      query === 'Promociones'
        ? 'Promociones activas'
        : `${results.length} resultado${results.length !== 1 ? 's' : ''}`;
  }
  showSection('search-view');
}

export function handleSearchInput(value) {
  const q = String(value || '').trim().toLowerCase();
  if (!q) {
    renderBrands();
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
