import { FALLBACKS } from '../config.js';
import { AppState, findProduct, findPromo } from '../state.js';
import { fmt, escapeHtml, escapeAttr } from '../lib/format.js';
import { promoDisplayPrice } from '../lib/sheet.js';

export function productCardHtml(p) {
  const promo = findPromo(p.id);
  const promoPrice = promoDisplayPrice(promo, p.precio);
  const img = p.imagen
    ? `<img src="${escapeAttr(p.imagen)}" alt="${escapeHtml(p.descripcion)}" loading="lazy" onerror="this.style.display='none'">`
    : '';
  const priceHtml =
    promoPrice != null
      ? `<div class="product-price">${fmt(promoPrice)} <span class="promo-inline">Promo x${promo.cantidad}</span></div>`
      : `<div class="product-price">${fmt(p.precio)}</div>`;

  return `<article class="product-card" data-id="${escapeAttr(p.id)}">
    <div class="product-img">${img}</div>
    <div class="product-body">
      <div>
        <div class="product-brand">${escapeHtml(p.marca)} · ${escapeHtml(p.subcategoria)}</div>
        <div class="product-name">${escapeHtml(p.descripcion)}</div>
        ${priceHtml}
      </div>
      <div class="product-buttons">
        <button class="btn btn-add" type="button" data-action="add" data-id="${escapeAttr(p.id)}">Agregar</button>
        <button class="btn btn-wa" type="button" data-action="wa" data-id="${escapeAttr(p.id)}" aria-label="Consultar por WhatsApp">WA</button>
      </div>
    </div>
  </article>`;
}

export function waForProduct(id) {
  const p = findProduct(id);
  if (!p) return null;
  const promo = findPromo(p.id);
  const price = promoDisplayPrice(promo, p.precio) ?? p.precio;
  const msg = `Hola, me interesa: ${p.descripcion} - ${fmt(price)}`;
  const phone = String(AppState.config.WHATSAPP || FALLBACKS.WHATSAPP).replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
