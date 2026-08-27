import { AppState } from '../state.js';
import { el, openOverlay, closeOverlay } from '../lib/dom.js';
import { escapeHtml, escapeAttr, fmt, idsMatch } from '../lib/format.js';
import { offerPrices } from '../lib/sheet.js';

function activeOffers() {
  const seen = new Set();
  const out = [];
  AppState.promos.forEach((pr) => {
    if (!pr.activo || !pr.id_producto || seen.has(pr.id_producto)) return;
    const product = AppState.products.find((p) => idsMatch(p.id, pr.id_producto));
    if (!product) return;
    seen.add(pr.id_producto);
    out.push({ promo: pr, product });
  });
  return out;
}

function offerSlideHtml({ promo, product }) {
  const { oldPrice, newPrice, showOld } = offerPrices(promo, product.precio);
  const imgSrc = promo.imagen_oferta || product.imagen;
  const img = imgSrc
    ? `<img src="${escapeAttr(imgSrc)}" alt="${escapeHtml(product.descripcion)}" draggable="false" onerror="this.style.display='none'">`
    : `<div class="offer-fallback">${escapeHtml((product.marca || '?')[0])}</div>`;
  const title = promo.titulo || 'Oferta especial';
  const old = showOld ? `<span class="offer-price-old">${fmt(oldPrice)}</span>` : '';

  return `<article class="offer-slide" data-id="${escapeAttr(product.id)}">
    <div class="offer-kicker">Oferta</div>
    <div class="offer-visual">${img}</div>
    <h3 class="offer-title">${escapeHtml(title)}</h3>
    <p class="offer-product">${escapeHtml(product.descripcion)}</p>
    <p class="offer-brand">${escapeHtml(product.marca)}${product.subcategoria ? ` · ${escapeHtml(product.subcategoria)}` : ''}</p>
    <div class="offer-prices">
      ${old}
      <span class="offer-price-now">${fmt(newPrice)}</span>
    </div>
    ${promo.cantidad > 0 ? `<span class="offer-pack">Promo x${promo.cantidad}</span>` : ''}
    <button class="btn btn-add offer-add" type="button" data-action="add" data-id="${escapeAttr(product.id)}">Agregar al carrito</button>
  </article>`;
}

export function renderLaunchOffer() {
  const stage = el('offer-stage');
  const dots = el('offer-dots');
  if (!stage) return [];
  const offers = activeOffers();
  if (!offers.length) {
    stage.innerHTML = '';
    if (dots) dots.innerHTML = '';
    return [];
  }
  stage.innerHTML = offers.map(offerSlideHtml).join('');
  if (dots) {
    dots.hidden = offers.length < 2;
    dots.innerHTML = offers
      .map(
        (_, i) =>
          `<button type="button" class="offer-dot${i === 0 ? ' is-active' : ''}" data-offer-dot="${i}" aria-label="Oferta ${i + 1}"></button>`
      )
      .join('');
  }
  stage.scrollLeft = 0;
  return offers;
}

export function closeLaunchOffer() {
  closeOverlay(el('modal-oferta'));
}

export function maybeShowLaunchOffer() {
  const offers = renderLaunchOffer();
  if (!offers.length) return;
  openOverlay(el('modal-oferta'));
}

export function bindOfferModal() {
  const modal = el('modal-oferta');
  const stage = el('offer-stage');
  if (!modal) return;

  el('btn-cerrar-oferta')?.addEventListener('click', closeLaunchOffer);
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'modal-oferta') closeLaunchOffer();
  });

  el('offer-dots')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-offer-dot]');
    if (!btn || !stage) return;
    const idx = Number(btn.getAttribute('data-offer-dot'));
    const slide = stage.children[idx];
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });

  stage?.addEventListener(
    'scroll',
    () => {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const idx = Math.round(stage.scrollLeft / w);
      el('offer-dots')
        ?.querySelectorAll('.offer-dot')
        .forEach((dot, i) => dot.classList.toggle('is-active', i === idx));
    },
    { passive: true }
  );

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="add"]')) {
      setTimeout(closeLaunchOffer, 180);
    }
  });
}

export function isLaunchOfferOpen() {
  return Boolean(el('modal-oferta')?.classList.contains('is-open'));
}
