import { LS } from './config.js';
import { padProductId, idsMatch } from './lib/format.js';

export const AppState = {
  products: [],
  brands: [],
  promos: [],
  config: {},
  errors: {},
  cart: [],
  currentSeccion: null,
  currentMarca: null,
  envioActivo: false,
  transferencia: false,
  direccion: ''
};

export function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(LS.CART);
    AppState.cart = raw ? JSON.parse(raw) : [];
  } catch {
    AppState.cart = [];
  }
}

export function saveCartToStorage() {
  try {
    localStorage.setItem(LS.CART, JSON.stringify(AppState.cart));
  } catch {
    /* quota */
  }
}

export function findProduct(id) {
  return AppState.products.find((p) => idsMatch(p.id, id));
}

export function findPromo(productId) {
  return AppState.promos.find(
    (pr) => pr.activo && idsMatch(pr.id_producto, productId) && pr.cantidad > 0
  );
}

export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => '<div class="skeleton-card" aria-hidden="true"></div>').join('');
}

export { padProductId };
