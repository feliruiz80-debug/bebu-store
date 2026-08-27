import { FALLBACKS } from '../config.js';
import { AppState, saveCartToStorage, findProduct, findPromo, findOfferItem } from '../state.js';
import { el, openOverlay, closeOverlay, showToast, setBottomNav } from '../lib/dom.js';
import { fmt, escapeHtml, escapeAttr, parsePrice, idsMatch } from '../lib/format.js';
import { linePrice } from '../lib/sheet.js';

export function addToCart(productId, qty = 1, { silent = false } = {}) {
  const prod = findProduct(productId);
  if (!prod) {
    if (!silent) showToast('Producto no encontrado');
    return false;
  }
  const offer = findOfferItem(prod.id);
  const promo = findPromo(prod.id);
  const addQty =
    offer || !(promo?.activo && promo.cantidad > 0) ? qty : promo.cantidad;
  const id = prod.id;
  const existing = AppState.cart.find((it) => idsMatch(it.id, id));
  if (existing) existing.qty += addQty;
  else AppState.cart.push({ id, qty: addQty });
  saveCartToStorage();
  renderCartDrawer();
  if (!silent) {
    const sizeHint = String(prod.subcategoria || '').trim();
    showToast(
      offer
        ? `Agregado${sizeHint ? ` talle ${sizeHint}` : ''} al carrito`
        : promo?.activo && promo.cantidad > 0
          ? `Agregado x${promo.cantidad} al carrito`
          : 'Agregado al carrito'
    );
  }
  return true;
}

export function updateCartQty(idx, delta) {
  if (idx < 0 || idx >= AppState.cart.length) return;
  AppState.cart[idx].qty += delta;
  if (AppState.cart[idx].qty <= 0) AppState.cart.splice(idx, 1);
  saveCartToStorage();
  renderCartDrawer();
}

export function removeCartItem(idx) {
  if (idx < 0 || idx >= AppState.cart.length) return;
  AppState.cart.splice(idx, 1);
  saveCartToStorage();
  renderCartDrawer();
}

export function clearCart() {
  AppState.cart = [];
  saveCartToStorage();
  renderCartDrawer();
}

export function computeCartTotals() {
  const items = [];
  let subtotal = 0;
  AppState.cart.forEach((cartItem) => {
    const prod = findProduct(cartItem.id);
    if (!prod) return;
    const offer = findOfferItem(prod.id);
    const promo = findPromo(prod.id);
    const priced =
      offer?.precio_oferta != null
        ? {
            unitPrice: offer.precio_oferta,
            subtotal: offer.precio_oferta * cartItem.qty,
            promoApplied: { cantidad: 0, oferta: true }
          }
        : linePrice(cartItem.qty, prod.precio, promo);
    subtotal += priced.subtotal;
    items.push({
      id: prod.id,
      qty: cartItem.qty,
      product: prod,
      unitPrice: priced.unitPrice,
      subtotal: priced.subtotal,
      promoApplied: priced.promoApplied,
      packs: priced.packs,
      rest: priced.rest
    });
  });
  const envio = AppState.envioActivo
    ? parsePrice(AppState.config.COSTO_ENVIO || AppState.config.COSTOENVIO || '') || FALLBACKS.COSTO_ENVIO
    : 0;
  return { items, subtotal, envio, total: subtotal + envio };
}

export function updateCartCounter() {
  const n = AppState.cart.reduce((s, it) => s + it.qty, 0);
  const label = n > 9 ? '9+' : String(n);
  ['contador-nav-carrito'].forEach((id) => {
    const counter = el(id);
    if (!counter) return;
    if (n > 0) {
      counter.textContent = label;
      counter.hidden = false;
    } else {
      counter.hidden = true;
    }
  });
}

function updateTotalsInModal(subtotal, envio, total) {
  const subtotalEl = el('subtotal-modal');
  const envioVal = el('envio-valor');
  const linea = el('linea-envio');
  const totalEl = el('total-final-modal');
  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  if (envioVal) envioVal.textContent = fmt(envio);
  if (linea) linea.hidden = !envio;
  if (totalEl) totalEl.textContent = fmt(total);
}

export function renderCartDrawer() {
  const wrapper = el('lista-carrito-modal');
  if (!wrapper) return;
  if (!AppState.cart.length) {
    wrapper.innerHTML = `<div class="cart-empty"><p>Tu carrito está vacío</p></div>`;
    updateCartCounter();
    updateTotalsInModal(0, 0, 0);
    return;
  }
  const { items, subtotal, envio, total } = computeCartTotals();
  wrapper.innerHTML = `<div class="cart-items">${items
    .map((it, idx) => {
      const thumb = it.product.imagen
        ? `<img class="cart-thumb" src="${escapeAttr(it.product.imagen)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="cart-thumb cart-thumb-fallback">${escapeHtml((it.product.marca || '?')[0])}</div>`;
      return `<div class="cart-item" data-idx="${idx}">
      ${thumb}
      <div class="cart-item-info">
        <div class="cart-item-brand">${escapeHtml(it.product.marca)} · ${escapeHtml(it.product.subcategoria)}</div>
        <div class="cart-item-name">${escapeHtml(it.product.descripcion)}</div>
        <div class="cart-item-price">${fmt(it.subtotal)}${it.promoApplied?.oferta ? ' <span class="promo-inline">Oferta</span>' : it.promoApplied ? ` <span class="promo-inline">Promo x${it.promoApplied.cantidad}</span>` : ''}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" type="button" data-action="dec" data-idx="${idx}" aria-label="Restar">−</button>
        <span class="qty-num">${it.qty}</span>
        <button class="qty-btn" type="button" data-action="inc" data-idx="${idx}" aria-label="Sumar">+</button>
        <button class="del-btn" type="button" data-action="del" data-idx="${idx}" aria-label="Quitar">×</button>
      </div>
    </div>`;
    })
    .join('')}</div>`;

  const btnDireccion = el('btn-abrir-direccion');
  if (btnDireccion) btnDireccion.hidden = !AppState.envioActivo;

  updateCartCounter();
  updateTotalsInModal(subtotal, envio, total);
}

export function openCartModal() {
  const modal = el('modal-carrito');
  renderCartDrawer();
  openOverlay(modal);
  setBottomNav('cart');
}

export function closeCartModal() {
  closeOverlay(el('modal-carrito'));
  if (el('modal-promos')?.classList.contains('is-open')) setBottomNav('promos');
  else if (el('modal-buscar')?.classList.contains('is-open')) setBottomNav('search');
  else setBottomNav('home');
}

export function openDireccionModal() {
  const modal = el('modal-direccion');
  const input = el('input-direccion');
  if (input) input.value = AppState.direccion;
  openOverlay(modal);
  input?.focus();
}

export function closeDireccionModal() {
  closeOverlay(el('modal-direccion'));
}

export function guardarDireccion() {
  const input = el('input-direccion');
  if (!input) return;
  AppState.direccion = input.value.trim();
  if (!AppState.direccion) {
    showToast('Ingresá una dirección');
    return;
  }
  closeDireccionModal();
  showToast('Dirección guardada');
}

export function sendOrderWhatsApp() {
  if (!AppState.cart.length) {
    showToast('El carrito está vacío');
    return;
  }
  if (AppState.envioActivo && !AppState.direccion) {
    openDireccionModal();
    return;
  }

  const phone = String(AppState.config.WHATSAPP || FALLBACKS.WHATSAPP).replace(/\D/g, '');
  const { items, subtotal, envio, total } = computeCartTotals();
  const lines = [
    'Hola, soy cliente de *BEBU*.',
    '',
    'Quisiera confirmar el siguiente pedido:',
    '',
    '*Productos*'
  ];

  items.forEach((it, i) => {
    const p = it.product;
    const brand = String(p.marca || '').trim();
    const size = String(p.subcategoria || '').trim();
    const tag = it.promoApplied?.oferta
      ? 'Oferta'
      : it.promoApplied?.cantidad
        ? `Promo x${it.promoApplied.cantidad}`
        : '';
    const details = [brand, size ? `Talle ${size}` : '', tag].filter(Boolean).join(' · ');
    const qtyLine =
      it.qty > 1 ? `${it.qty} un. × ${fmt(it.unitPrice)}` : `${it.qty} un.`;

    lines.push(`${i + 1}. *${p.descripcion}*`);
    if (details) lines.push(details);
    lines.push(`${qtyLine} — *${fmt(it.subtotal)}*`, '');
  });

  lines.push('────────────────', '*Resumen*');
  lines.push(`Productos: ${fmt(subtotal)}`);
  if (envio) lines.push(`Envío a domicilio: ${fmt(envio)}`);
  lines.push(`*Total: ${fmt(total)}*`, '');

  lines.push('*Entrega*');
  if (AppState.envioActivo) {
    lines.push('Envío a domicilio');
    if (AppState.direccion) lines.push(`Dirección: ${AppState.direccion}`);
  } else {
    lines.push('A coordinar');
  }
  lines.push('');

  lines.push('*Forma de pago*');
  if (AppState.transferencia) {
    lines.push('Transferencia bancaria');
    lines.push('Alias: TIENDABEBU');
  } else {
    lines.push('A coordinar');
  }
  lines.push('');
  lines.push('Quedo atento para confirmar disponibilidad y coordinar. ¡Gracias!');

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  showToast('Pedido abierto en WhatsApp. El carrito se mantiene.');
}
