import { AppState } from '../state.js';
import { el, showSection } from '../lib/dom.js';
import { escapeHtml, escapeAttr, idsMatch } from '../lib/format.js';
import { FALLBACKS, HOME_SECTIONS } from '../config.js';

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

export function renderHomeSections() {
  const container = el('sections-grid');
  if (!container) return;

  AppState.currentSeccion = null;
  AppState.currentMarca = null;

  container.innerHTML = HOME_SECTIONS.map((section) => {
    const qty = productsForSection(section).length;
    const centerClass = section.center ? ' section-card--center' : '';
    return `<button type="button" class="section-card${centerClass}" data-section="${escapeAttr(section.id)}" style="--section-accent: ${section.accent}">
      <span class="section-bubbles" aria-hidden="true">
        <span class="section-bubble section-bubble--lg"></span>
        <span class="section-bubble section-bubble--md"></span>
        <span class="section-bubble section-bubble--sm"></span>
      </span>
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
