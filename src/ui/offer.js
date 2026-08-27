import { AppState } from '../state.js';
import { el, openOverlay, closeOverlay, showToast } from '../lib/dom.js';
import { escapeHtml, escapeAttr, fmt, idsMatch } from '../lib/format.js';
import { offerPrices } from '../lib/sheet.js';
import { addToCart } from './cart.js';

function looksLikeUrl(raw) {
  return /^https?:\/\//i.test(String(raw || '').trim());
}

function cardOffers() {
  const seen = new Set();
  const out = [];
  AppState.promos.forEach((pr) => {
    if (!pr.activo || !pr.es_tarjeta || seen.has(pr.id_producto || pr.id_imagen)) return;
    const product =
      AppState.products.find((p) => idsMatch(p.id, pr.id_producto)) ||
      AppState.products.find((p) => idsMatch(p.id, pr.id_imagen)) ||
      null;
    seen.add(pr.id_producto || pr.id_imagen);
    out.push({ promo: pr, product });
  });
  return out.slice(0, 3);
}

function resolveImage({ promo, product }) {
  const k = String(promo.id_imagen || '').trim();
  if (looksLikeUrl(k)) return k;
  if (k) {
    const byK = AppState.products.find((p) => idsMatch(p.id, k));
    if (byK?.imagen) return byK.imagen;
  }
  return product?.imagen || '';
}

function comboPrices(offers) {
  const priced = offers.map(({ promo, product }) => offerPrices(promo, product?.precio || 0));
  const withDeal = priced.filter((p) => p.showOld || p.newPrice);
  if (!withDeal.length) return { oldPrice: null, newPrice: null, showOld: false };

  const first = priced.find((p) => p.showOld) || priced[0];
  const othersHavePrices = priced.filter((p) => p.newPrice != null).length > 1;
  if (othersHavePrices) {
    const oldPrice = priced.reduce((s, p) => s + (p.oldPrice || 0), 0);
    const newPrice = priced.reduce((s, p) => s + (p.newPrice || 0), 0);
    return { oldPrice, newPrice, showOld: oldPrice > newPrice };
  }
  return first;
}

function offerCardHtml(offers) {
  const title =
    offers.map((o) => o.promo.titulo).find(Boolean) ||
    offers.map((o) => o.product?.descripcion).find(Boolean) ||
    'Oferta';
  const { oldPrice, newPrice, showOld } = comboPrices(offers);
  const photos = offers
    .map((item, idx) => {
      const src = resolveImage(item);
      if (!src) return '';
      return `<img class="offer-float-item offer-float-item--${idx + 1}" src="${escapeAttr(src)}" alt="" draggable="false" onerror="this.style.display='none'">`;
    })
    .join('');
  const old = showOld && oldPrice != null ? `<span class="offer-price-old">${fmt(oldPrice)}</span>` : '';
  const now = newPrice != null ? `<span class="offer-price-now">${fmt(newPrice)}</span>` : '';

  return `<article class="offer-slide offer-slide--combo">
    <div class="offer-kicker">Oferta</div>
    <div class="offer-float" aria-hidden="true">${photos}</div>
    <h3 class="offer-title">${escapeHtml(title)}</h3>
    <div class="offer-prices">${old}${now}</div>
    <button class="btn btn-add offer-add" type="button" data-action="buy-offer">Comprar</button>
  </article>`;
}

export function renderLaunchOffer() {
  const stage = el('offer-stage');
  const dots = el('offer-dots');
  if (!stage) return [];
  const offers = cardOffers();
  if (dots) {
    dots.hidden = true;
    dots.innerHTML = '';
  }
  if (!offers.length) {
    stage.innerHTML = '';
    return [];
  }
  stage.innerHTML = offerCardHtml(offers);
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

function buyLaunchOffer() {
  const offers = cardOffers();
  const ids = offers.map((o) => o.product?.id || o.promo.id_producto).filter(Boolean);
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
  if (!modal) return;

  el('btn-cerrar-oferta')?.addEventListener('click', closeLaunchOffer);
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'modal-oferta') closeLaunchOffer();
    if (e.target.closest('[data-action="buy-offer"]')) buyLaunchOffer();
  });
}

export function isLaunchOfferOpen() {
  return Boolean(el('modal-oferta')?.classList.contains('is-open'));
}
