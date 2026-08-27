import { AppState } from '../state.js';
import { el, openOverlay, closeOverlay, showToast } from '../lib/dom.js';
import { escapeHtml, escapeAttr, fmt, idsMatch } from '../lib/format.js';
import { addToCart } from './cart.js';

function looksLikeUrl(raw) {
  return /^https?:\/\//i.test(String(raw || '').trim());
}

export function getOfferCardItems() {
  return (AppState.offerCard || []).slice(0, 3);
}

function productForItem(item) {
  return (
    AppState.products.find((p) => idsMatch(p.id, item.id_producto)) ||
    AppState.products.find((p) => idsMatch(p.id, item.id_imagen)) ||
    null
  );
}

export function resolveOfferImage(item) {
  const k = String(item.id_imagen || '').trim();
  if (looksLikeUrl(k)) return k;
  const product = productForItem(item);
  if (product?.imagen) return product.imagen;
  return '';
}

function offerMeta(items) {
  const title = items.map((i) => i.titulo).find(Boolean) || 'Oferta especial';
  const olds = items.map((i) => i.precio_antes).filter((n) => n != null);
  const news = items.map((i) => i.precio_oferta).filter((n) => n != null);
  const oldPrice = olds.length ? olds.reduce((s, n) => s + n, 0) : null;
  const newPrice = news.length ? news.reduce((s, n) => s + n, 0) : null;
  return {
    title,
    oldPrice,
    newPrice,
    showOld: oldPrice != null && newPrice != null && oldPrice > newPrice
  };
}

function photosHtml(items, extraClass = '') {
  return items
    .map((item, idx) => {
      const src = resolveOfferImage(item);
      if (!src) return '';
      return `<img class="offer-float-item offer-float-item--${idx + 1} ${extraClass}" src="${escapeAttr(src)}" alt="" draggable="false" onerror="this.style.display='none'">`;
    })
    .join('');
}

export function offerCardHtml(items = getOfferCardItems()) {
  if (!items.length) return '';
  const { title, oldPrice, newPrice, showOld } = offerMeta(items);
  const old = showOld ? `<span class="offer-price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="offer-price-now">${fmt(newPrice)}</span>` : '';

  return `<article class="offer-slide offer-slide--combo">
    <p class="offer-kicker">Solo por tiempo limitado</p>
    <div class="offer-float" aria-hidden="true">${photosHtml(items)}</div>
    <h3 class="offer-title">${escapeHtml(title)}</h3>
    <div class="offer-prices">${old}${now}</div>
    <button class="btn btn-add offer-add" type="button" data-action="buy-offer">Comprar</button>
  </article>`;
}

export function offerPromoListHtml(items = getOfferCardItems()) {
  if (!items.length) return '';
  const { title, oldPrice, newPrice, showOld } = offerMeta(items);
  const old = showOld ? `<span class="price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="price-now">${fmt(newPrice)}</span>` : '';

  return `<article class="product-card offer-promo-row">
    <div class="offer-promo-photos" aria-hidden="true">${photosHtml(items, 'offer-promo-photo')}</div>
    <div class="product-body">
      <div>
        <div class="product-brand">Oferta especial</div>
        <div class="product-name">${escapeHtml(title)}</div>
        <div class="product-price">${old}${now}</div>
      </div>
      <div class="product-buttons">
        <button class="btn btn-add offer-add" type="button" data-action="buy-offer">Comprar</button>
      </div>
    </div>
  </article>`;
}

export function renderLaunchOffer() {
  const stage = el('offer-stage');
  if (!stage) return [];
  const items = getOfferCardItems();
  const dots = el('offer-dots');
  if (dots) {
    dots.hidden = true;
    dots.innerHTML = '';
  }
  if (!items.length) {
    stage.innerHTML = '';
    return [];
  }
  stage.innerHTML = offerCardHtml(items);
  return items;
}

export function closeLaunchOffer() {
  closeOverlay(el('modal-oferta'));
}

export function maybeShowLaunchOffer() {
  const items = renderLaunchOffer();
  if (!items.length) return;
  openOverlay(el('modal-oferta'));
}

export function buyOfferCard() {
  const items = getOfferCardItems();
  const ids = items.map((item) => productForItem(item)?.id || item.id_producto).filter(Boolean);
  let added = 0;
  ids.forEach((id) => {
    if (addToCart(id, 1, { silent: true })) added += 1;
  });
  if (added) showToast(added > 1 ? 'Agregados al carrito' : 'Agregado al carrito');
  else showToast('Producto no encontrado');
  closeLaunchOffer();
}

export function bindOfferModal() {
  const modal = el('modal-oferta');
  el('btn-cerrar-oferta')?.addEventListener('click', closeLaunchOffer);
  modal?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-oferta') closeLaunchOffer();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="buy-offer"]')) buyOfferCard();
  });
}

export function isLaunchOfferOpen() {
  return Boolean(el('modal-oferta')?.classList.contains('is-open'));
}
