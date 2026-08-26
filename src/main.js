import './style.css';
import { FALLBACKS } from './config.js';
import { AppState, loadCartFromStorage, skeletonCards } from './state.js';
import { loadAllData } from './lib/sheet.js';
import { el, bindActivate, showToast } from './lib/dom.js';
import { renderBrands, renderSubcategories } from './ui/brands.js';
import { renderProducts, renderPromotions, handleSearchInput } from './ui/catalog.js';
import {
  addToCart,
  updateCartQty,
  removeCartItem,
  clearCart,
  renderCartDrawer,
  openCartModal,
  closeCartModal,
  openDireccionModal,
  closeDireccionModal,
  guardarDireccion,
  sendOrderWhatsApp,
  updateCartCounter
} from './ui/cart.js';
import { waForProduct } from './ui/products.js';
import { registerSW } from 'virtual:pwa-register';

function applyTheme(config) {
  const root = document.documentElement;
  const map = {
    COLOR_1: '--accent-1',
    COLOR_2: '--bg-warm',
    COLOR_3: '--accent-2',
    COLOR_4: '--accent-3',
    COLOR_5: '--brand-text',
    COLOR_6: '--accent-4'
  };
  Object.entries(map).forEach(([key, cssVar]) => {
    if (config[key]) root.style.setProperty(cssVar, config[key]);
  });
  for (let i = 1; i <= 6; i++) {
    const key = `COLOR_${i}`;
    if (config[key]) root.style.setProperty(`--color-${i}`, config[key]);
  }
  const logoEl = el('logo-global');
  if (logoEl) {
    logoEl.src = FALLBACKS.LOGO_LOCAL;
    logoEl.onerror = () => {
      logoEl.src = FALLBACKS.LOGO_LOCAL;
    };
  }
}

function setupStickyHeader() {
  const header = document.querySelector('.header-pro');
  if (!header) return;

  const RANGE = 72;
  let ticking = false;
  let last = -1;

  const apply = (y) => {
    const progress = Math.min(1, Math.max(0, y / RANGE));
    const rounded = Math.round(progress * 100) / 100;
    if (rounded === last) return;
    last = rounded;
    header.style.setProperty('--collapse', String(rounded));
    header.classList.toggle('is-collapsed', rounded > 0.85);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      apply(window.scrollY || document.documentElement.scrollTop || 0);
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  apply(window.scrollY || 0);
}

function goBack() {
  const current = document.querySelector('.section.active');
  if (!current) return;
  if (current.id === 'products-view') renderSubcategories(AppState.currentMarca);
  else renderBrands();
  const searchInput = el('buscador');
  if (searchInput) searchInput.value = '';
}

function bindUI() {
  let searchTimer = null;
  el('buscador')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => handleSearchInput(e.target.value), 220);
  });

  const app = el('app-container');
  if (app) {
    bindActivate(app, '.brand-card', (card) => {
      const marca = card.getAttribute('data-marca');
      if (marca === 'PROMOCIONES' || card.dataset.action === 'promos') {
        renderPromotions();
        return;
      }
      AppState.currentMarca = marca;
      renderSubcategories(marca);
    });
    bindActivate(app, '.subcat-card', (card) => {
      renderProducts(AppState.currentMarca, card.getAttribute('data-sub'));
    });
    app.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'add') addToCart(id, 1);
      if (action === 'wa') {
        const url = waForProduct(id);
        if (!url) return showToast('Producto no encontrado');
        window.open(url, '_blank');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDireccionModal();
      closeCartModal();
    }
  });

  el('btn-carrito-header')?.addEventListener('click', openCartModal);
  el('btn-volver')?.addEventListener('click', goBack);
  el('btn-cerrar-carrito')?.addEventListener('click', closeCartModal);
  el('modal-carrito')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-carrito') closeCartModal();
  });

  el('btn-vaciar-carrito')?.addEventListener('click', () => {
    if (confirm('¿Vaciar carrito?')) clearCart();
  });

  el('lista-carrito-modal')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-idx'));
    const action = btn.getAttribute('data-action');
    if (action === 'inc') updateCartQty(idx, 1);
    if (action === 'dec') updateCartQty(idx, -1);
    if (action === 'del') removeCartItem(idx);
  });

  el('switch-envio')?.addEventListener('change', (e) => {
    AppState.envioActivo = e.target.checked;
    renderCartDrawer();
  });
  el('switch-transferencia')?.addEventListener('change', (e) => {
    AppState.transferencia = e.target.checked;
  });

  el('btn-enviar-whatsapp')?.addEventListener('click', sendOrderWhatsApp);
  el('btn-abrir-direccion')?.addEventListener('click', openDireccionModal);
  el('btn-guardar-direccion')?.addEventListener('click', guardarDireccion);
  el('close-direccion-btn')?.addEventListener('click', closeDireccionModal);
  el('close-direccion-btn-2')?.addEventListener('click', closeDireccionModal);
  el('input-direccion')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') guardarDireccion();
  });
}

function setupPwa() {
  const banner = el('update-banner');
  const updateSW = registerSW({
    onNeedRefresh() {
      banner?.classList.remove('hidden');
    },
    onOfflineReady() {}
  });
  el('btn-update-now')?.addEventListener('click', () => updateSW(true));
  el('btn-update-later')?.addEventListener('click', () => banner?.classList.add('hidden'));
}

async function bootstrap() {
  loadCartFromStorage();
  bindUI();
  setupStickyHeader();
  setupPwa();
  updateCartCounter();

  const brandsGrid = el('brands-grid');
  if (brandsGrid) brandsGrid.innerHTML = skeletonCards(8);

  try {
    const data = await loadAllData();
    AppState.products = data.productos;
    AppState.brands = data.marcas;
    AppState.promos = data.promos;
    AppState.config = data.config;
    AppState.errors = data.errors;
    applyTheme(AppState.config);
    renderBrands();
    updateCartCounter();
    if (Object.keys(data.errors).length) {
      showToast(`No se pudo leer: ${Object.keys(data.errors).join(', ')}`, 4000);
    }
  } catch (err) {
    console.error(err);
    if (brandsGrid) {
      brandsGrid.innerHTML =
        '<div class="empty-state"><p>Error al cargar el catálogo. Revisá que el Sheet esté publicado para la web.</p></div>';
    }
  }
}

bootstrap();
