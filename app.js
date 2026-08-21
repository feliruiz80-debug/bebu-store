/* BEBU Store - app.js (versión profesional mejorada)
   Consume Google Sheet (public) - gviz iz JSON (gviz/tq?tqx=out:json)
   - Mejoras: logo visible, buscador funcional, modal dirección, envío correcto, WhatsApp limpio
*/

/* ================= CONFIG ================= */
const SHEET_ID = '1JBnOCILUFaXuWIgUJGOZYPXKV-nQdOTfAXw2voUnKd8';

const GIDS = {
  PRODUCTOS: '1022185098',
  MARCAS: '1283244979',
  CONFIG: '340621461',
  PROMOS: '718207796'
};

const SHEET_TTL = 60 * 1000; // 60s

const FALLBACKS = {
  WHATSAPP: '543517694762',
  COSTO_ENVIO: 2500,
  LOGO_LOCAL: '/logo.png'
};

const LS = {
  CART: 'bebu:cart:v1',
  SHEET_CACHE: 'bebu:sheetcache:v1'
};

/* ================== UTIL =================== */

async function fetchGvizJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Network response not ok: ' + res.status);
  const text = await res.text();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Unexpected gviz format');
  const jsonText = text.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function gvizTableToObjects(gvizObj) {
  const cols = (gvizObj.table && gvizObj.table.cols) || [];
  const rows = (gvizObj.table && gvizObj.table.rows) || [];
  const headers = cols.map(c => (c.label || c.id || '').toString().trim());
  return rows.map(r => {
    const obj = {};
    (r.c || []).forEach((cell, i) => {
      const key = headers[i] || `col${i}`;
      obj[key] = (cell && (cell.v !== undefined ? cell.v : '')) || '';
    });
    return obj;
  });
}

function getCachedSheet(key) {
  try {
    const raw = localStorage.getItem(LS.SHEET_CACHE);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[key];
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.ts > SHEET_TTL) {
      delete store[key];
      localStorage.setItem(LS.SHEET_CACHE, JSON.stringify(store));
      return null;
    }
    return entry.data;
  } catch (e) {
    return null;
  }
}

function setCachedSheet(key, data) {
  try {
    const raw = localStorage.getItem(LS.SHEET_CACHE);
    const store = raw ? JSON.parse(raw) : {};
    store[key] = { ts: Date.now(), data };
    localStorage.setItem(LS.SHEET_CACHE, JSON.stringify(store));
  } catch (e) {}
}

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
function fmt(v) { return currency.format(Math.round(v || 0)); }

function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s === '') return null;
  s = s.replace(/\s/g, '').replace(/^\$/, '').replace(/ARS/i, '');
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/* normalize image urls from sheets and fallback */
function normalizeImageUrl(raw) {
  if (raw === null || raw === undefined) return FALLBACKS.LOGO_LOCAL;
  const s = String(raw).trim();
  if (!s) return FALLBACKS.LOGO_LOCAL;
  if (/^data:/i.test(s)) return s;
  if (/^\/\//.test(s)) return location.protocol + s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\//.test(s)) return s;
  return FALLBACKS.LOGO_LOCAL;
}

/* ================= DATA LAYER ================= */

async function fetchSheetTab(gid) {
  const cacheKey = `gid:${gid}`;
  const cached = getCachedSheet(cacheKey);
  if (cached) return cached;

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
  const json = await fetchGvizJson(url);
  const arr = gvizTableToObjects(json);
  setCachedSheet(cacheKey, arr);
  return arr;
}

async function loadAllData() {
  const [productosRaw, marcasRaw, configRaw, promosRaw] = await Promise.all([
    fetchSheetTab(GIDS.PRODUCTOS).catch(err => { console.error('Productos error', err); return []; }),
    fetchSheetTab(GIDS.MARCAS).catch(err => { console.error('Marcas error', err); return []; }),
    fetchSheetTab(GIDS.CONFIG).catch(err => { console.error('Config error', err); return []; }),
    fetchSheetTab(GIDS.PROMOS).catch(err => { console.error('Promos error', err); return []; })
  ]);

  const config = {};
  configRaw.forEach(row => {
    const keys = Object.keys(row);
    if (keys.length >= 2) {
      const k = String(row[keys[0]] || '').toString().trim();
      const v = row[keys[1]] !== undefined ? row[keys[1]] : '';
      if (k) config[k] = v;
    }
  });

  const marcas = marcasRaw.map(r => {
    const lower = mapKeysLower(r);
    return {
      marca: (lower['marca'] || lower['name'] || '').toString().trim().toUpperCase(),
      logo: (lower['url_logo'] || lower['url-logo'] || lower['logo'] || '').toString().trim()
    };
  }).filter(m => m.marca);

  const productos = productosRaw.map(r => {
    const lower = mapKeysLower(r);
    const precioRaw = lower['precio'] !== undefined ? lower['precio'] : (lower['price'] || '');
    return {
      id: (lower['id'] !== undefined ? String(lower['id']) : (lower['ID'] !== undefined ? String(lower['ID']) : '')) || '',
      marca: (lower['marca'] || lower['brand'] || '').toString().trim().toUpperCase(),
      subcategoria: (lower['subcategoria'] || lower['category'] || lower['subcat'] || 'GENERAL').toString().trim(),
      descripcion: (lower['descripcion'] || lower['description'] || '').toString().trim(),
      precio: parsePrice(precioRaw) || 0,
      imagen: normalizeImageUrl(lower['url_imagen'] || lower['url_imagen_producto'] || lower['image'] || '')
    };
  }).filter(p => p.id && p.descripcion);

  const truthySet = new Set(['si','s','true','1','ok','yes','activo','on']);
  const promos = promosRaw.map(r => {
    const lower = mapKeysLower(r);
    const activeRaw = String(lower['activo'] || lower['active'] || lower['estado'] || '').toString().trim().toLowerCase();
    const cantidadRaw = lower['cantidad'] || lower['qty'] || lower['cantidad_min'] || lower['min_qty'] || 0;
    return {
      id_promo: (lower['id_promo'] || lower['idpromo'] || lower['promo_id'] || '').toString().trim(),
      id_producto: (lower['id_producto'] || lower['idproducto'] || lower['product_id'] || lower['producto_id'] || '').toString().trim(),
      cantidad: parseInt(cantidadRaw || 0, 10) || 0,
      precio_promo: parsePrice(lower['precio_promo'] || lower['precio'] || lower['promoprice'] || lower['price']) || null,
      activo: truthySet.has(activeRaw)
    };
  }).filter(p => p.id_producto);

  return { productos, marcas, config, promos };
}

function mapKeysLower(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    out[k.toString().trim().toLowerCase().replace(/\s+/g, '_')] = obj[k];
  });
  return out;
}

/* ================= APP STATE ================= */

const AppState = {
  products: [],
  brands: [],
  promos: [],
  config: {},
  cart: [],
  navigationStack: [],
  currentMarca: null,
  envioActivo: false,
  transferencia: false,
  direccion: ''
};

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(LS.CART);
    AppState.cart = raw ? JSON.parse(raw) : [];
  } catch (e) {
    AppState.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(LS.CART, JSON.stringify(AppState.cart));
  } catch (e) {}
}

/* =============== UI RENDER HELPERS =============== */

function el(id) { return document.getElementById(id); }
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function showSection(id) {
  $all('.section').forEach(s => s.classList.remove('active'));
  const elSec = el(id);
  if (elSec) elSec.classList.add('active');
  const content = document.querySelector('.content');
  if (content) content.scrollTop = 0;
  updateBackButton();
}

function updateBackButton() {
  const btnVolver = el('btn-volver');
  if (!btnVolver) return;
  const current = document.querySelector('.section.active');
  const currentId = current ? current.id : '';
  btnVolver.style.display = currentId === 'brands-view' || currentId === 'search-view' ? 'none' : 'inline-flex';
}

function goBack() {
  const current = document.querySelector('.section.active');
  if (!current) return;
  
  if (current.id === 'products-view') {
    renderSubcategories(AppState.currentMarca);
  } else if (current.id === 'subcats-view') {
    renderBrands();
  } else if (current.id === 'search-view') {
    renderBrands();
  }
  
  const searchInput = el('buscador');
  if (searchInput) searchInput.value = '';
}

function updateThemeFromConfig(config) {
  const root = document.documentElement;
  for (let i = 1; i <= 6; i++) {
    const key = `COLOR_${i}`;
    if (config[key]) root.style.setProperty(`--color-${i}`, config[key]);
  }
  const logoUrl = config['URL_LOGO_APP'] || config['url_logo_app'] || config['url_logo'] || config['URL_LOGO'] || FALLBACKS.LOGO_LOCAL;
  const logoEl = el('logo-global');
  if (logoEl) {
    if (logoEl.tagName === 'IMG') {
      logoEl.src = normalizeImageUrl(logoUrl);
      logoEl.onerror = () => { logoEl.src = FALLBACKS.LOGO_LOCAL; };
    } else {
      logoEl.innerHTML = `<img src="${normalizeImageUrl(logoUrl)}" alt="BEBU" onerror="this.src='${FALLBACKS.LOGO_LOCAL}'">`;
    }
  }
}

/* =============== RENDER: BRANDS / SUBCATS / PRODUCTS =============== */

function renderPromotions() {
  const activePromos = AppState.promos.filter(pr => pr.activo && pr.id_producto);
  const seenIds = new Set();
  const results = [];
  activePromos.forEach(pr => {
    if (seenIds.has(String(pr.id_producto))) return;
    const prod = AppState.products.find(p => String(p.id) === String(pr.id_producto));
    if (prod) {
      const copy = Object.assign({}, prod);
      if (pr.precio_promo) copy.precio = pr.precio_promo;
      copy._promo = pr;
      results.push(copy);
      seenIds.add(String(pr.id_producto));
    }
  });
  renderSearchResults(results, 'Promociones');
}

function renderBrands() {
  const container = el('brands-grid');
  if (!container) return;
  container.innerHTML = '';
  const marcasMap = {};
  AppState.products.forEach(p => {
    if (!p.marca) return;
    marcasMap[p.marca] = marcasMap[p.marca] || { count: 0, logo: '' };
    marcasMap[p.marca].count++;
  });
  AppState.brands.forEach(b => {
    if (b.marca) {
      marcasMap[b.marca] = marcasMap[b.marca] || { count: 0, logo: '' };
      if (b.logo) marcasMap[b.marca].logo = b.logo;
    }
  });

  const orderedBrands = [];
  const activePromosCount = AppState.promos.filter(pr => pr.activo).length;
  if (activePromosCount > 0) {
    orderedBrands.push('__PROMOS__');
  }
  AppState.brands.forEach(b => {
    if (b.marca && marcasMap[b.marca] && !orderedBrands.includes(b.marca)) {
      orderedBrands.push(b.marca);
    }
  });
  const productBrandsOrder = [];
  AppState.products.forEach(p => {
    if (p.marca && !productBrandsOrder.includes(p.marca)) productBrandsOrder.push(p.marca);
  });
  productBrandsOrder.forEach(pb => {
    if (marcasMap[pb] && !orderedBrands.includes(pb)) orderedBrands.push(pb);
  });

  if (orderedBrands.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">No hay marcas disponibles</div></div>`;
    showSection('brands-view');
    return;
  }

  const html = orderedBrands.map(marca => {
    if (marca === '__PROMOS__') {
      return `<div class="brand-card promo-card" data-marca="PROMOCIONES" role="button" tabindex="0" data-action="promos">
        <div class="brand-img"><div class="promo-badge">PROMOCIONES</div></div>
        <div class="brand-body"><div class="brand-name">Promociones</div><div class="brand-count">${activePromosCount} promo${activePromosCount!==1?'s':''}</div></div>
      </div>`;
    }
    const logo = marcasMap[marca].logo;
    const count = marcasMap[marca].count;
    const logoUrl = logo ? normalizeImageUrl(logo) : '';
    const logoHtml = logoUrl ? `<img src="${escapeAttr(logoUrl)}" alt="${escapeHtml(marca)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACKS.LOGO_LOCAL}';">` : `<div class="brand-initial">${escapeHtml(marca[0]||'?')}</div>`;
    return `<div class="brand-card" data-marca="${escapeAttr(marca)}" role="button" tabindex="0">
      <div class="brand-img">${logoHtml}</div>
      <div class="brand-body"><div class="brand-name">${escapeHtml(marca)}</div><div class="brand-count">${count} producto${count!==1?'s':''}</div></div>
    </div>`;
  }).join('');
  container.innerHTML = html;

  showSection('brands-view');
}

function renderSubcategories(marca) {
  const container = el('subcats-grid');
  if (!container) return;
  container.innerHTML = '';
  const items = AppState.products.filter(p => p.marca === marca);
  const subs = items.map(i => i.subcategoria).filter((v, i, self) => v && self.indexOf(v) === i);
  if (subs.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">No hay líneas para ${escapeHtml(marca)}</div></div>`;
    return;
  }
  container.innerHTML = subs.map(s => {
    const qty = items.filter(i => i.subcategoria === s).length;
    return `<div class="subcat-card" data-sub="${escapeAttr(s)}" role="button" tabindex="0">
      <div class="subcat-name">${escapeHtml(s)}</div><div class="subcat-count">${qty} producto${qty!==1?'s':''}</div>
    </div>`;
  }).join('');
  el('subcats-label') && (el('subcats-label').textContent = `Líneas de ${marca}`);
  AppState.currentMarca = marca;
  showSection('subcats-view');
}

function renderProducts(marca, subcat) {
  const container = el('products-grid');
  if (!container) return;
  container.innerHTML = '';
  const list = AppState.products.filter(p => p.marca === marca && p.subcategoria === subcat);
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">Sin productos</div></div>`;
    return;
  }
  container.innerHTML = list.map(p => {
    const imgUrl = normalizeImageUrl(p.imagen);
    const img = `<img src="${escapeAttr(imgUrl)}" alt="${escapeHtml(p.descripcion)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACKS.LOGO_LOCAL}';">`;
    return `<div class="product-card" data-id="${escapeAttr(p.id)}">
      <div class="product-img">${img}</div>
      <div class="product-body">
        <div>
          <div class="product-brand">${escapeHtml(p.marca)} - ${escapeHtml(p.subcategoria)}</div>
          <div class="product-name">${escapeHtml(p.descripcion)}</div>
          <div class="product-price">${fmt(p.precio)}</div>
        </div>
        <div class="product-buttons">
          <button class="btn btn-add" data-action="add" data-id="${escapeAttr(p.id)}">Agregar</button>
          <button class="btn btn-wa" data-action="wa" data-id="${escapeAttr(p.id)}">WhatsApp</button>
        </div>
      </div>
    </div>`;
  }).join('');
  el('products-label') && (el('products-label').textContent = `${subcat} - ${list.length} producto${list.length!==1?'s':''}`);
  showSection('products-view');
}

/* ================= SEARCH ================= */

let searchDebounceTimer = null;
function handleSearchInput(value) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const q = (value || '').toString().trim().toLowerCase();
    if (!q) {
      renderBrands();
      return;
    }
    const resultados = AppState.products.filter(p => {
      return p.descripcion.toLowerCase().includes(q) ||
             p.marca.toLowerCase().includes(q) ||
             p.subcategoria.toLowerCase().includes(q);
    });
    renderSearchResults(resultados, value);
  }, 220);
}

function renderSearchResults(results, query) {
  const container = el('search-grid');
  if (!container) return;
  if (results.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">Sin resultados para "${escapeHtml(query)}"</div></div>`;
    showSection('search-view');
    return;
  }
  container.innerHTML = results.map(p => {
    const imgUrl = normalizeImageUrl(p.imagen);
    const img = `<img src="${escapeAttr(imgUrl)}" alt="${escapeHtml(p.descripcion)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACKS.LOGO_LOCAL}';">`;
    return `<div class="product-card" data-id="${escapeAttr(p.id)}">
      <div class="product-img">${img}</div>
      <div class="product-body">
        <div>
          <div class="product-brand">${escapeHtml(p.marca)} - ${escapeHtml(p.subcategoria)}</div>
          <div class="product-name">${escapeHtml(p.descripcion)}</div>
          <div class="product-price">${fmt(p.precio)}</div>
        </div>
        <div class="product-buttons">
          <button class="btn btn-add" data-action="add" data-id="${escapeAttr(p.id)}">Agregar</button>
          <button class="btn btn-wa" data-action="wa" data-id="${escapeAttr(p.id)}">WhatsApp</button>
        </div>
      </div>
    </div>`;
  }).join('');
  el('search-count-label') && (el('search-count-label').textContent = `${results.length} resultado${results.length!==1?'s':''}`);
  showSection('search-view');
}

/* ================= CART LOGIC ================ */

function addToCart(productId, qty = 1) {
  const id = String(productId);
  const existing = AppState.cart.find(it => it.id === id);
  if (existing) existing.qty += qty;
  else AppState.cart.push({ id, qty });
  saveCartToStorage();
  renderCartDrawer();
  showToast('Agregado al carrito');
}

function updateCartQty(idx, delta) {
  if (idx < 0 || idx >= AppState.cart.length) return;
  AppState.cart[idx].qty += delta;
  if (AppState.cart[idx].qty <= 0) AppState.cart.splice(idx, 1);
  saveCartToStorage();
  renderCartDrawer();
}

function removeCartItem(idx) {
  if (idx < 0 || idx >= AppState.cart.length) return;
  AppState.cart.splice(idx, 1);
  saveCartToStorage();
  renderCartDrawer();
}

function computeCartTotals() {
  const items = [];
  let subtotal = 0;
  AppState.cart.forEach(cartItem => {
    const prod = AppState.products.find(p => String(p.id) === String(cartItem.id));
    if (!prod) return;
    const promo = AppState.promos.find(pr => String(pr.id_producto) === String(prod.id) && pr.activo && pr.precio_promo && pr.cantidad > 0);
    let unitPrice = prod.precio;
    let promoApplied = null;
    if (promo && cartItem.qty >= promo.cantidad) {
      unitPrice = promo.precio_promo;
      promoApplied = promo;
    }
    const subtotalItem = unitPrice * cartItem.qty;
    subtotal += subtotalItem;
    items.push({
      id: prod.id,
      qty: cartItem.qty,
      product: prod,
      unitPrice,
      subtotal: subtotalItem,
      promoApplied
    });
  });

  const envio = AppState.envioActivo ? (parsePrice(AppState.config['COSTO_ENVIO'] || AppState.config['COSTOENVIO'] || '') || FALLBACKS.COSTO_ENVIO) : 0;
  const total = subtotal + envio;
  return { items, subtotal, envio, total };
}

/* ================= CART DRAWER UI ================= */

function renderCartDrawer() {
  const wrapper = el('lista-carrito-modal');
  if (!wrapper) return;
  if (!AppState.cart || AppState.cart.length === 0) {
    wrapper.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">Carrito vacío</div><p>Tu carrito está vacío</p></div>`;
    updateCartCounter();
    updateTotalsInModal(0, 0, 0);
    return;
  }
  const { items, subtotal, envio, total } = computeCartTotals();
  const htmlItems = items.map((it, idx) => {
    return `<div class="cart-item" data-idx="${idx}">
      <div class="cart-item-info">
        <div class="cart-item-brand">${escapeHtml(it.product.marca)} - ${escapeHtml(it.product.subcategoria)}</div>
        <div class="cart-item-name">${escapeHtml(it.product.descripcion)}</div>
        <div class="cart-item-price">${fmt(it.unitPrice)} c/u ${it.promoApplied ? '<span class="promo-inline">Promo</span>' : ''}</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" data-action="dec" data-idx="${idx}">-</button>
        <span class="qty-num">${it.qty}</span>
        <button class="qty-btn" data-action="inc" data-idx="${idx}">+</button>
        <button class="del-btn" data-action="del" data-idx="${idx}">x</button>
      </div>
    </div>`;
  }).join('');
  wrapper.innerHTML = `<div class="cart-items">${htmlItems}</div>`;
  
  const btnDireccion = el('btn-abrir-direccion');
  if (btnDireccion) {
    btnDireccion.style.display = AppState.envioActivo ? 'inline-block' : 'none';
  }
  
  updateCartCounter();
  updateTotalsInModal(subtotal, envio, total);
}

function updateTotalsInModal(subtotal, envio, total) {
  const subtotalEl = el('subtotal-modal');
  const envioVal = el('envio-valor');
  const linea = el('linea-envio');
  const totalEl = el('total-final-modal');
  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  if (envioVal) envioVal.textContent = fmt(envio);
  if (linea) linea.style.display = envio ? 'flex' : 'none';
  if (totalEl) totalEl.textContent = fmt(total);
}

function updateCartCounter() {
  const counter = el('contador-carrito');
  if (!counter) return;
  const n = AppState.cart.reduce((s, it) => s + it.qty, 0);
  if (n > 0) { counter.textContent = n > 9 ? '9+' : String(n); counter.style.display = 'inline-flex'; }
  else { counter.style.display = 'none'; }
}

/* ================== MODAL DIRECCION =================== */

function openDireccionModal() {
  const modal = el('modal-direccion');
  if (!modal) return;
  modal.style.display = 'block';
  const input = el('input-direccion');
  if (input) input.value = AppState.direccion;
}

function closeDireccionModal() {
  const modal = el('modal-direccion');
  if (!modal) return;
  modal.style.display = 'none';
}

function guardarDireccion() {
  const input = el('input-direccion');
  if (!input) return;
  AppState.direccion = input.value.trim();
  if (!AppState.direccion) {
    showToast('Ingresa una dirección');
    return;
  }
  closeDireccionModal();
  showToast('Dirección guardada');
}

/* ================== WHATSAPP CHECKOUT ================= */

function sendOrderWhatsApp() {
  if (!AppState.cart || AppState.cart.length === 0) { showToast('El carrito está vacío'); return; }
  
  if (AppState.envioActivo && !AppState.direccion) {
    openDireccionModal();
    return;
  }

  const phone = String(AppState.config['WHATSAPP'] || AppState.config['Whatsapp'] || AppState.config['whatsapp'] || FALLBACKS.WHATSAPP).replace(/\D/g,'');
  const { items, subtotal, envio, total } = computeCartTotals();
  const lines = [];
  
  lines.push('PEDIDO BEBU');
  lines.push('');
  lines.push('DETALLE DEL PEDIDO');
  items.forEach(it => {
    lines.push(`${it.qty}x ${it.product.descripcion} - ${fmt(it.unitPrice)} c/u = ${fmt(it.subtotal)}`);
  });
  lines.push('');
  lines.push('RESUMEN DE PAGO');
  lines.push(`Subtotal: ${fmt(subtotal)}`);
  if (envio) lines.push(`Envío: ${fmt(envio)}`);
  lines.push(`TOTAL: ${fmt(total)}`);
  lines.push('');
  
  if (AppState.envioActivo) {
    lines.push('ENVÍO A DOMICILIO');
    lines.push(`Dirección: ${AppState.direccion}`);
    lines.push('');
  }
  
  if (AppState.transferencia) {
    lines.push('FORMA DE PAGO');
    lines.push('Transferencia bancaria');
    lines.push('Alias: TIENDABEBU');
    lines.push('');
  }
  
  lines.push('Por confirmar');

  const text = encodeURIComponent(lines.join('\n'));
  const url = `https://wa.me/${phone}?text=${text}`;
  window.open(url, '_blank');

  setTimeout(() => {
    AppState.cart = [];
    AppState.direccion = '';
    AppState.envioActivo = false;
    AppState.transferencia = false;
    saveCartToStorage();
    renderCartDrawer();
    const envioCheck = el('switch-envio');
    const transCheck = el('switch-transferencia');
    if (envioCheck) envioCheck.checked = false;
    if (transCheck) transCheck.checked = false;
  }, 700);
}

/* ================== UI: toasts, helpers ================= */

function showToast(msg, t = 2000) {
  const existing = document.querySelector('.bebu-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'bebu-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), t);
}

function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return String(s || '').replace(/"/g,'&quot;'); }

/* =================== EVENTS BINDING =================== */

function bindUI() {
  const searchInput = el('buscador');
  if (searchInput) searchInput.addEventListener('input', e => handleSearchInput(e.target.value));

  const appContainer = el('app-container');
  if (appContainer) {
    appContainer.addEventListener('click', e => {
      const brandCard = e.target.closest('.brand-card');
      if (brandCard) {
        const marca = brandCard.getAttribute('data-marca');
        if (marca === 'PROMOCIONES' || brandCard.dataset.action === 'promos') {
          renderPromotions();
          return;
        }
        AppState.currentMarca = marca;
        renderSubcategories(marca);
        return;
      }
      const subCard = e.target.closest('.subcat-card');
      if (subCard) {
        const sub = subCard.getAttribute('data-sub');
        renderProducts(AppState.currentMarca, sub);
        return;
      }
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'add') addToCart(id, 1);
        else if (action === 'wa') {
          const p = AppState.products.find(pp => String(pp.id) === String(id));
          if (!p) return showToast('Producto no encontrado');
          const msg = `Hola, me interesa: ${p.descripcion} - ${fmt(p.precio)}`;
          const phone = String(AppState.config['WHATSAPP'] || FALLBACKS.WHATSAPP).replace(/\D/g,'');
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
        return;
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCartModal();
  });

  const cartBtn = el('btn-carrito-header');
  if (cartBtn) cartBtn.addEventListener('click', openCartModal);

  const backBtn = el('btn-volver');
  if (backBtn) backBtn.addEventListener('click', goBack);

  document.addEventListener('click', e => {
    if (e.target.closest('.close-btn')) closeCartModal();
    if (e.target.closest('.btn-vaciar-carrito')) {
      if (confirm('Vaciar carrito?')) {
        AppState.cart = [];
        saveCartToStorage();
        renderCartDrawer();
      }
    }
  });

  const modalList = el('lista-carrito-modal');
  if (modalList) {
    modalList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const idx = Number(btn.getAttribute('data-idx'));
      if (action === 'inc') updateCartQty(idx, 1);
      else if (action === 'dec') updateCartQty(idx, -1);
      else if (action === 'del') removeCartItem(idx);
    });
  }

  const envioToggle = el('switch-envio');
  if (envioToggle) {
    envioToggle.addEventListener('change', () => {
      AppState.envioActivo = envioToggle.checked;
      renderCartDrawer();
    });
  }

  const transToggle = el('switch-transferencia');
  if (transToggle) {
    transToggle.addEventListener('change', () => {
      AppState.transferencia = transToggle.checked;
    });
  }

  const sendBtn = el('btn-enviar-whatsapp');
  if (sendBtn) sendBtn.addEventListener('click', sendOrderWhatsApp);

  const btnDireccion = el('btn-abrir-direccion');
  if (btnDireccion) btnDireccion.addEventListener('click', openDireccionModal);

  const btnGuardar = el('btn-guardar-direccion');
  if (btnGuardar) btnGuardar.addEventListener('click', guardarDireccion);

  const closeDirBtn = el('close-direccion-btn');
  if (closeDirBtn) closeDirBtn.addEventListener('click', closeDireccionModal);
  
  const closeDirBtn2 = el('close-direccion-btn-2');
  if (closeDirBtn2) closeDirBtn2.addEventListener('click', closeDireccionModal);

  const inputDireccion = el('input-direccion');
  if (inputDireccion) {
    inputDireccion.addEventListener('keypress', e => {
      if (e.key === 'Enter') guardarDireccion();
    });
  }
}

/* =================== CART MODAL OPEN/CLOSE =================== */

function openCartModal() {
  const modal = el('modal-carrito');
  if (!modal) return;
  modal.style.display = 'block';
  renderCartDrawer();
}

function closeCartModal() {
  const modal = el('modal-carrito');
  if (!modal) return;
  modal.style.display = 'none';
}

/* =================== BOOTSTRAP APP =================== */

async function bootstrap() {
  try {
    const logoEl = el('logo-global');
    if (logoEl && logoEl.tagName === 'IMG') {
      logoEl.src = FALLBACKS.LOGO_LOCAL;
      logoEl.onerror = () => { logoEl.src = FALLBACKS.LOGO_LOCAL; };
    }

    loadCartFromStorage();
    bindUI();
    const brandsGrid = el('brands-grid');
    if (brandsGrid) brandsGrid.innerHTML = `<div class="loading">Cargando...</div>`;

    const data = await loadAllData();
    AppState.products = data.productos || [];
    AppState.brands = (data.marcas || []).map(m => ({ marca: m.marca, logo: m.logo }));
    AppState.promos = data.promos || [];
    AppState.config = data.config || {};

    updateThemeFromConfig(AppState.config);
    renderBrands();
    updateCartCounter();

  } catch (err) {
    console.error('Bootstrap error', err);
    const container = el('brands-grid');
    if (container) container.innerHTML = `<div class="empty-state"><div class="ei">Error al cargar. Revisa la consola.</div></div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});

