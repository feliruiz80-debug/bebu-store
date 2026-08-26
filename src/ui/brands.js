import { AppState } from '../state.js';
import { el, showSection } from '../lib/dom.js';
import { escapeHtml, escapeAttr } from '../lib/format.js';
import { FALLBACKS } from '../config.js';

export function renderBrands() {
  const container = el('brands-grid');
  if (!container) return;

  const marcasMap = {};
  AppState.products.forEach((p) => {
    if (!p.marca) return;
    marcasMap[p.marca] = marcasMap[p.marca] || { count: 0, logo: '' };
    marcasMap[p.marca].count++;
  });
  AppState.brands.forEach((b) => {
    if (!b.marca) return;
    marcasMap[b.marca] = marcasMap[b.marca] || { count: 0, logo: '' };
    if (b.logo) marcasMap[b.marca].logo = b.logo;
  });

  const ordered = [];
  const activePromos = AppState.promos.filter((pr) => pr.activo && pr.id_producto);
  if (activePromos.length) ordered.push('__PROMOS__');

  AppState.brands.forEach((b) => {
    if (b.marca && marcasMap[b.marca] && !ordered.includes(b.marca)) ordered.push(b.marca);
  });
  AppState.products.forEach((p) => {
    if (p.marca && marcasMap[p.marca] && !ordered.includes(p.marca)) ordered.push(p.marca);
  });

  if (!ordered.length) {
    const err = AppState.errors.Productos;
    container.innerHTML = `<div class="empty-state"><p>${err ? 'No se pudo leer Productos. Publicá el Sheet para la web.' : 'No hay marcas disponibles.'}</p></div>`;
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
  const items = AppState.products.filter((p) => p.marca === marca);
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
