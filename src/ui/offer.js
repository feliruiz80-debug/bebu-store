import { AppState } from '../state.js';
import { el, openOverlay, closeOverlay, showToast } from '../lib/dom.js';
import { escapeHtml, escapeAttr, fmt, idsMatch } from '../lib/format.js';
import { addToCart } from './cart.js';

let selectedOfferId = '';

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

function itemProductId(item) {
  return productForItem(item)?.id || item.id_producto || '';
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

export function descriptionWithoutSize(text) {
  return String(text || '')
    .replace(/\btalle\s*/gi, '')
    .replace(/\b(xxg|xg|xxl|xl|rn|nb|[pmgn])\b/gi, ' ')
    .replace(/\s*[·|,/-]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function offerMeta(items) {
  const sheetTitle = items.map((i) => i.titulo).find(Boolean) || '';
  const product = items.map(productForItem).find(Boolean);
  const description = descriptionWithoutSize(sheetTitle || product?.descripcion || '');
  const olds = items.map((i) => i.precio_antes).filter((n) => n != null);
  const news = items.map((i) => i.precio_oferta).filter((n) => n != null);
  const uniqueOld = [...new Set(olds)];
  const uniqueNew = [...new Set(news)];
  const oldPrice = uniqueOld.length === 1 ? uniqueOld[0] : olds.length ? olds.reduce((s, n) => s + n, 0) : null;
  const newPrice = uniqueNew.length === 1 ? uniqueNew[0] : news.length ? news.reduce((s, n) => s + n, 0) : null;
  return {
    description,
    oldPrice,
    newPrice,
    showOld: oldPrice != null && newPrice != null && oldPrice > newPrice
  };
}

function syncSelectedSizes() {
  document.querySelectorAll('[data-action="pick-offer-size"]').forEach((node) => {
    const on = idsMatch(node.getAttribute('data-id'), selectedOfferId);
    node.classList.toggle('is-selected', on);
    node.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function sizeCardsHtml(items) {
  return items
    .map((item, idx) => {
      const product = productForItem(item);
      const id = itemProductId(item);
      const src = resolveOfferImage(item);
      const size = productSizeLabel(product) || `Opción ${idx + 1}`;
      const selected = idsMatch(id, selectedOfferId) ? ' is-selected' : '';
      const img = src
        ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(size)}" draggable="false" onerror="this.style.display='none'">`
        : `<div class="offer-fallback">${escapeHtml((product?.marca || '?')[0])}</div>`;
      return `<button type="button" class="offer-size offer-size--${idx + 1}${selected}" data-action="pick-offer-size" data-id="${escapeAttr(id)}" aria-pressed="${selected ? 'true' : 'false'}">
        <div class="offer-size-photo">${img}</div>
        <span class="offer-size-tag">${escapeHtml(size)}</span>
      </button>`;
    })
    .join('');
}

export function offerCardHtml(items = getOfferCardItems()) {
  if (!items.length) return '';
  const { description, oldPrice, newPrice, showOld } = offerMeta(items);
  const old = showOld ? `<span class="offer-price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="offer-price-now">${fmt(newPrice)}</span>` : '';
  const subtitle = description
    ? `<p class="offer-subtitle">${escapeHtml(description)}</p>`
    : '';

  return `<article class="offer-slide offer-slide--combo">
    <p class="offer-flag">Oferta</p>
    ${subtitle}
    <div class="offer-sizes">${sizeCardsHtml(items)}</div>
    <p class="offer-pick-hint">Elegí el talle</p>
    <div class="offer-prices">${old}${now}</div>
    <button class="btn btn-add offer-add" type="button" data-action="buy-offer">Comprar</button>
  </article>`;
}

export function offerCarouselCardHtml(items = getOfferCardItems()) {
  if (!items.length) return '';
  const { description, oldPrice, newPrice, showOld } = offerMeta(items);
  const thumbs = items
    .map((item) => {
      const src = resolveOfferImage(item);
      return src
        ? `<img src="${escapeAttr(src)}" alt="" draggable="false" onerror="this.style.display='none'">`
        : '';
    })
    .join('');
  const old = showOld ? `<span class="carousel-card-price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="carousel-card-price">${fmt(newPrice)}</span>` : '';

  return `<button type="button" class="carousel-card carousel-card--offer" data-action="open-offer" aria-label="Ver oferta">
    <div class="carousel-card-img carousel-offer-thumbs">${thumbs}</div>
    <div class="carousel-card-body">
      <div class="carousel-offer-flag">OFERTA</div>
      <div class="carousel-card-name">${escapeHtml(description || 'Oferta especial')}</div>
      <div class="carousel-card-meta">
        <div class="carousel-card-pricing">
          ${old}
          ${now}
        </div>
      </div>
    </div>
  </button>`;
}

export function offerPromoListHtml(items = getOfferCardItems()) {
  if (!items.length) return '';
  const { description, oldPrice, newPrice, showOld } = offerMeta(items);
  const old = showOld ? `<span class="price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="price-now">${fmt(newPrice)}</span>` : '';

  return `<article class="product-card offer-promo-row">
    <div class="offer-promo-photos">${sizeCardsHtml(items)}</div>
    <div class="product-body">
      <div>
        <div class="product-name">${escapeHtml(description || 'Combo especial')}</div>
        <p class="offer-pick-hint offer-pick-hint--mini">Elegí el talle</p>
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
  if (!selectedOfferId) {
    showToast('Elegí un talle');
    return;
  }
  const item = getOfferCardItems().find((it) => idsMatch(itemProductId(it), selectedOfferId));
  const id = item ? itemProductId(item) : selectedOfferId;
  const product = item ? productForItem(item) : null;
  const size = productSizeLabel(product);
  if (addToCart(id, 1, { silent: true })) {
    showToast(size ? `Agregado talle ${size}` : 'Agregado al carrito');
    closeLaunchOffer();
  }
}

export function bindOfferModal() {
  const modal = el('modal-oferta');
  el('btn-cerrar-oferta')?.addEventListener('click', closeLaunchOffer);
  modal?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-oferta') closeLaunchOffer();
  });
  document.addEventListener('click', (e) => {
    const sizeBtn = e.target.closest('[data-action="pick-offer-size"]');
    if (sizeBtn) {
      selectedOfferId = sizeBtn.getAttribute('data-id') || '';
      syncSelectedSizes();
      return;
    }
    if (e.target.closest('[data-action="buy-offer"]')) buyOfferCard();
    if (e.target.closest('[data-action="open-offer"]')) maybeShowLaunchOffer();
  });
}

export function isLaunchOfferOpen() {
  return Boolean(el('modal-oferta')?.classList.contains('is-open'));
}
