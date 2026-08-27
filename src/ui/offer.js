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

export function productSizeLabel(product) {
  if (!product) return '';
  const blob = `${product.descripcion || ''} ${product.subcategoria || ''}`;
  const m = blob.match(/\b(XXG|XG|XXL|XL|RN|NB|[PMGN])\b/i);
  if (m) return m[1].toUpperCase();
  const sub = String(product.subcategoria || '').trim();
  if (sub && !/^general$/i.test(sub)) return sub;
  return '';
}

function offerMeta(items) {
  const title = items.map((i) => i.titulo).find(Boolean) || '';
  const olds = items.map((i) => i.precio_antes).filter((n) => n != null);
  const news = items.map((i) => i.precio_oferta).filter((n) => n != null);
  const uniqueOld = [...new Set(olds)];
  const uniqueNew = [...new Set(news)];
  const oldPrice = uniqueOld.length === 1 ? uniqueOld[0] : olds.length ? olds.reduce((s, n) => s + n, 0) : null;
  const newPrice = uniqueNew.length === 1 ? uniqueNew[0] : news.length ? news.reduce((s, n) => s + n, 0) : null;
  return {
    title,
    oldPrice,
    newPrice,
    showOld: oldPrice != null && newPrice != null && oldPrice > newPrice
  };
}

function sizeCardsHtml(items) {
  return items
    .map((item, idx) => {
      const product = productForItem(item);
      const src = resolveOfferImage(item);
      const size = productSizeLabel(product);
      const img = src
        ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(size || product?.descripcion || '')}" draggable="false" onerror="this.style.display='none'">`
        : `<div class="offer-fallback">${escapeHtml((product?.marca || '?')[0])}</div>`;
      return `<div class="offer-size offer-size--${idx + 1}">
        <div class="offer-size-photo">${img}</div>
        ${size ? `<span class="offer-size-tag">${escapeHtml(size)}</span>` : ''}
      </div>`;
    })
    .join('');
}

export function offerCardHtml(items = getOfferCardItems()) {
  if (!items.length) return '';
  const { title, oldPrice, newPrice, showOld } = offerMeta(items);
  const old = showOld ? `<span class="offer-price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="offer-price-now">${fmt(newPrice)}</span>` : '';
  const subtitle = title ? `<p class="offer-subtitle">${escapeHtml(title)}</p>` : '';

  return `<article class="offer-slide offer-slide--combo">
    <p class="offer-flag">Oferta</p>
    <div class="offer-sizes">${sizeCardsHtml(items)}</div>
    ${subtitle}
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
    <div class="offer-promo-photos">${sizeCardsHtml(items)}</div>
    <div class="product-body">
      <div>
        <div class="offer-flag offer-flag--mini">Oferta</div>
        <div class="product-name">${escapeHtml(title || 'Combo especial')}</div>
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
