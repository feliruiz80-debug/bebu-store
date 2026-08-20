/* BEBU Store - app.js
   Consume Google Sheet (public) - gv iz JSON (gviz/tq?tqx=out:json)
   - Reemplaza el app.js antiguo.
   - Antes de usar: publica las 4 pestañas del sheet (Archivo -> Publicar en la web).
   - Configurable via const SHEET_ID y GIDS.
*/

/* ================= CONFIG ================= */
const SHEET_ID = '1JBnOCILUFaXuWIgUJGOZYPXKV-nQdOTfAXw2voUnKd8';

// GIDs que mencionaste
const GIDS = {
  PRODUCTOS: '1022185098',
  MARCAS: '1283244979',
  CONFIG: '340621461',
  PROMOS: '718207796'
};

// TTL cache en ms (lecturas desde Sheet)
const SHEET_TTL = 60 * 1000; // 60s

// WhatsApp y envío se leerán desde sheet Config; fallback si no existe:
const FALLBACKS = {
  WHATSAPP: '543517694762',
  COSTO_ENVIO: 2500,
  LOGO_LOCAL: '/icons/logo-192.png'
};

// LocalStorage keys
const LS = {
  CART: 'bebu:cart:v1',
  SHEET_CACHE: 'bebu:sheetcache:v1'
};

/* ================== UTIL =================== */

// Parse respuesta "gviz" que viene envuelta: "/*O_o*/ google.visualization.Query.setResponse(...);"
async function fetchGvizJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Network response not ok: ' + res.status);
  const text = await res.text();

  // Extraer JSON entre la primera "({" o "setResponse(" y la última ");"
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Unexpected gviz format');
  const jsonText = text.slice(start, end + 1);
  return JSON.parse(jsonText);
}

// Convierte la tabla gviz a array de objetos usando la primera fila como headers
function gvizTableToObjects(gvizObj) {
  // gvizObj.table.cols -> [{label, id, type}]
  // gvizObj.table.rows -> [{c:[{v:..}, {v:..}]}, ...]
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

// Cache simple en localStorage para respuestas del sheet
function getCachedSheet(key) {
  try {
    const raw = localStorage.getItem(LS.SHEET_CACHE);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[key];
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.ts > SHEET_TTL) {
      // caducó
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

// Formateo moneda ARS sin decimales (según requeriste antes)
const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
function fmt(v) { return currency.format(Math.round(v || 0)); }

// Limpia precio entrante (cadena o número) a número
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

// Carga las 4 pestañas en paralelo y normaliza
async function loadAllData() {
  const [productosRaw, marcasRaw, configRaw, promosRaw] = await Promise.all([
    fetchSheetTab(GIDS.PRODUCTOS).catch(err => { console.error('Productos error', err); return []; }),
    fetchSheetTab(GIDS.MARCAS).catch(err => { console.error('Marcas error', err); return []; }),
    fetchSheetTab(GIDS.CONFIG).catch(err => { console.error('Config error', err); return []; }),
    fetchSheetTab(GIDS.PROMOS).catch(err => { console.error('Promos error', err); return []; })
  ]);

  // Normalizar Config: clave/valor por fila
  const config = {};
  configRaw.forEach(row => {
    // asumir primer col = key, segunda col = value (no dependemos del label exacto)
    const keys = Object.keys(row);
    if (keys.length >= 2) {
      const k = String(row[keys[0]] || '').toString().trim();
      const v = row[keys[1]] !== undefined ? row[keys[1]] : '';
      if (k) config[k] = v;
    }
  });

  // Normalizar Marcas
  // Soporta columnas: MARCA, URL_LOGO (nombres exactos pero tolera otras mayúsculas)
  const marcas = marcasRaw.map(r => {
    const lower = mapKeysLower(r);
    return {
      marca: (lower['marca'] || lower['name'] || '').toString().trim().toUpperCase(),
      logo: (lower['url_logo'] || lower['url-logo'] || lower['logo'] || '').toString().trim()
    };
  }).filter(m => m.marca);

  // Normalizar Productos
  // ID | MARCA | SUBCATEGORIA | DESCRIPCION | PRECIO | URL_IMAGEN
  const productos = productosRaw.map(r => {
    const lower = mapKeysLower(r);
    const precioRaw = lower['precio'] !== undefined ? lower['precio'] : (lower['price'] || '');
    return {
      id: (lower['id'] !== undefined ? String(lower['id']) : (lower['ID'] !== undefined ? String(lower['ID']) : '')) || '',
      marca: (lower['marca'] || lower['brand'] || '').toString().trim().toUpperCase(),
      subcategoria: (lower['subcategoria'] || lower['category'] || lower['subcat'] || 'GENERAL').toString().trim(),
      descripcion: (lower['descripcion'] || lower['description'] || '').toString().trim(),
      precio: parsePrice(precioRaw) || 0,
      imagen: (lower['url_imagen'] || lower['url_imagen_producto'] || lower['image'] || '').toString().trim()
    };
  }).filter(p => p.id && p.descripcion);

  // Normalizar Promos
  // ID_PROMO | ID_PRODUCTO | CANTIDAD | PRECIO_PROMO | ACTIVO (SI/NO)
  const promos = promosRaw.map(r => {
    const lower = mapKeysLower(r);
    return {
      id_promo: (lower['id_promo'] || lower['idpromo'] || '').toString().trim(),
      id_producto: (lower['id_producto'] || lower['idproducto'] || lower['product_id'] || '').toString().trim(),
      cantidad: parseInt(lower['cantidad'] || lower['qty'] || lower['cantidad_min'] || 0, 10) || 0,
      precio_promo: parsePrice(lower['precio_promo'] || lower['precio'] || lower['promoprice']) || null,
      activo: String(lower['activo'] || lower['active'] || '').toString().trim().toLowerCase() === 'si'
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
  products: [],        // productos normalizados
  brands: [],          // marcas normalizadas
  promos: [],          // promos
  config: {},          // config
  cart: []             // {id_producto, cantidad}
};

// Cargar carrito desde localStorage
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
}

function updateThemeFromConfig(config) {
  // CONFIG may contain COLOR_1..COLOR_6 and URL_LOGO_APP
  const root = document.documentElement;
  for (let i = 1; i <= 6; i++) {
    const key = `COLOR_${i}`;
    if (config[key]) root.style.setProperty(`--color-${i}`, config[key]);
  }
  // logo
  const logoUrl = config['URL_LOGO_APP'] || config['url_logo_app'] || '';
  const logoEl = el('logo-global') || el('logo-box');
  if (logoEl && logoUrl) {
    if (logoEl.tagName === 'IMG') {
      logoEl.src = logoUrl;
      logoEl.onerror = () => { logoEl.src = FALLBACKS.LOGO_LOCAL; };
    } else {
      logoEl.innerHTML = `<img src="${logoUrl}" alt="BEBU" onerror="this.src='${FALLBACKS.LOGO_LOCAL}'">`;
    }
  } else if (logoEl) {
    // fallback local
    if (logoEl.tagName === 'IMG') {
      logoEl.src = FALLBACKS.LOGO_LOCAL;
    }
  }
}

// Breadcrumb
function updateBreadcrumb() {
  const bc = el('breadcrumb');
  if (!bc) return;
  const state = el('products-view').classList.contains('active') ? 'Productos' :
                el('subcats-view').classList.contains('active') ? 'Lineas' : 'Marcas';
  // basic
  bc.textContent = state;
  if (state === 'Marcas') bc.classList.add('hidden'); else bc.classList.remove('hidden');
}

/* =============== RENDER: BRANDS / SUBCATS / PRODUCTS =============== */

function renderBrands() {
  const container = el('brands-grid');
  container.innerHTML = '';
  // Agrupar marcas encontradas en productos (para asegurar que sólo marcas con productos se muestren)
  const marcasMap = {};
  AppState.products.forEach(p => {
    marcasMap[p.marca] = marcasMap[p.marca] || { count: 0, logo: '' };
    marcasMap[p.marca].count++;
  });
  // merge logos from AppState.brands
  AppState.brands.forEach(b => {
    if (b.marca) {
      marcasMap[b.marca] = marcasMap[b.marca] || { count: 0, logo: '' };
      if (b.logo) marcasMap[b.marca].logo = b.logo;
    }
  });

  const marcasList = Object.keys(marcasMap).sort();
  if (marcasList.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">😕</div><p>No hay marcas disponibles</p></div>`;
    return;
  }

  const html = marcasList.map(marca => {
    const logo = marcasMap[marca].logo;
    const count = marcasMap[marca].count;
    const logoHtml = logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(marca)}" loading="lazy" onerror="this.style.display='none'">` : `<div class="brand-initial">${escapeHtml(marca[0]||'?')}</div>`;
    return `<div class="brand-card" data-marca="${escapeAttr(marca)}" role="button" tabindex="0">
      <div class="brand-img">${logoHtml}</div>
      <div class="brand-body"><div class="brand-name">${escapeHtml(marca)}</div><div class="brand-count">${count} producto${count!==1?'s':''}</div></div>
    </div>`;
  }).join('');
  container.innerHTML = html;

  showSection('brands-view');
  updateBreadcrumb();
}

function renderSubcategories(marca) {
  const container = el('subcats-grid');
  container.innerHTML = '';
  const items = AppState.products.filter(p => p.marca === marca);
  const subs = Array.from(new Set(items.map(i => i.subcategoria))).sort();
  if (subs.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">😕</div><p>No hay líneas para ${escapeHtml(marca)}</p></div>`;
    return;
  }
  container.innerHTML = subs.map(s => {
    const qty = items.filter(i => i.subcategoria === s).length;
    return `<div class="subcat-card" data-sub="${escapeAttr(s)}" role="button" tabindex="0">
      <div class="subcat-name">${escapeHtml(s)}</div><div class="subcat-count">${qty} producto${qty!==1?'s':''}</div>
    </div>`;
  }).join('');
  el('subcats-label') && (el('subcats-label').textContent = `Líneas de ${marca}`);
  showSection('subcats-view');
  updateBreadcrumb();
}

function renderProducts(marca, subcat) {
  const container = el('products-grid');
  container.innerHTML = '';
  const list = AppState.products.filter(p => p.marca === marca && p.subcategoria === subcat);
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="ei">😕</div><p>Sin productos</p></div>`;
    return;
  }
  container.innerHTML = list.map(p => {
    const promoHtml = renderPromoBadgeIfAny(p.id);
    const img = p.imagen ? `<img src="${escapeAttr(p.imagen)}" alt="${escapeHtml(p.descripcion)}" loading="lazy" onerror="this.style.display='none'">` : '';
    return `<div class="product-card" data-id="${escapeAttr(p.id)}">
      <div class="product-img">${img}</div>
      <div class="product-body">
        <div>
          <div class="product-brand">${escapeHtml(p.marca)} - ${escapeHtml(p.subcategoria)}</div>
          <div class="product-name">${escapeHtml(p.descripcion)}</div>
          <div class="product-price">${fmt(p.precio)} ${promoHtml ? '<span style="margin-left:6px">'+promoHtml+'</span>' : ''}</div>
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
  updateBreadcrumb();
}

// Render badge si existe promo activa (ej: "Oferta: Llevando 2, $X")
function renderPromoBadgeIfAny(productId) {
  const promos = AppState.promos.filter(pr => pr.id_producto === String(productId) && pr.activo && pr.precio_promo);
  if (!promos || promos.length === 0) return '';
  const p = promos[0];
  return `<span class="promo-badge" title="Promo: ${p.cantidad} o más a ${fmt(p.precio_promo)}">¡Oferta!</span>`;
}

/* ================= SEARCH ================= */

let searchDebounceTimer = null;
function handleSearchInput(value) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const q = (value || '').toString().trim().toLowerCase();
    if (!q) {
      // volver a vista previa
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
    container.innerHTML = `<div class="empty-state"><div class="ei">🔎</div><p>Sin resultados para "${escapeHtml(query)}"</p></div>`;
    showSection('search-view');
    return;
  }
  container.innerHTML = results.map(p => {
    const img = p.imagen ? `<img src="${escapeAttr(p.imagen)}" alt="${escapeHtml(p.descripcion)}" loading="lazy" onerror="this.style.display='none'">` : '';
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
  el('search-count-label') && (el('search-count-label').textContent = `${results.length} resultado${results.length!==1?'s':''} para "${query}"`);
  showSection('search-view');
}

/* ================= CART LOGIC (promos aplicadas) ================ */

// Añadir producto al carrito. Identificador de item = id_producto
function addToCart(productId, qty = 1) {
  const id = String(productId);
  const existing = AppState.cart.find(it => it.id === id);
  if (existing) existing.qty += qty;
  else AppState.cart.push({ id, qty });
  saveCartToStorage();
  renderCartDrawer();
  showToast('Agregado al carrito');
}

// Cambiar cantidad (incremento/decremento directo)
function updateCartQty(idx, delta) {
  if (idx < 0 || idx >= AppState.cart.length) return;
  AppState.cart[idx].qty += delta;
  if (AppState.cart[idx].qty <= 0) AppState.cart.splice(idx, 1);
  saveCartToStorage();
  renderCartDrawer();
}

// Remove item
function removeCartItem(idx) {
  if (idx < 0 || idx >= AppState.cart.length) return;
  AppState.cart.splice(idx, 1);
  saveCartToStorage();
  renderCartDrawer();
}

// Compute prices applying promos:
// Returns { items:[{id, qty, product, unitPrice, subtotal, promoApplied}], subtotal, envio, total }
function computeCartTotals() {
  const items = [];
  let subtotal = 0;
  AppState.cart.forEach(cartItem => {
    const prod = AppState.products.find(p => String(p.id) === String(cartItem.id));
    if (!prod) return;
    // buscar promo activa para este producto
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

  const envio = parsePrice(AppState.config['COSTO_ENVIO'] || AppState.config['COSTOENVIO'] || '') || FALLBACKS.COSTO_ENVIO;
  const total = subtotal + (AppState.cart.length ? envio : 0);
  return { items, subtotal, envio, total };
}

/* ================= CART DRAWER UI ================= */

function renderCartDrawer() {
  const wrapper = el('lista-carrito-modal');
  if (!wrapper) return;
  if (!AppState.cart || AppState.cart.length === 0) {
    wrapper.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🧺</div><p>Tu carrito está vacío</p></div>`;
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
        <div class="cart-item-price">${fmt(it.unitPrice)} c/u ${it.promoApplied ? '<span class="promo-inline">Promo aplicada</span>' : ''}</div>
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
  updateCartCounter();
  updateTotalsInModal(subtotal, envio, total);
}

function updateTotalsInModal(subtotal, envio, total) {
  const subtotalEl = el('subtotal-modal');
  const envioLine = el('linea-envio');
  const totalEl = el('total-final-modal');
  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  if (envioLine) envioLine.style.display = envio ? 'flex' : 'none';
  if (totalEl) totalEl.textContent = fmt(total);
}

function updateCartCounter() {
  const counter = el('contador-carrito') || el('badge');
  if (!counter) return;
  const n = AppState.cart.reduce((s, it) => s + it.qty, 0);
  if (n > 0) { counter.textContent = n > 9 ? '9+' : String(n); counter.style.display = 'inline-flex'; }
  else { counter.style.display = 'none'; }
}

/* ================== WHATSAPP CHECKOUT ================= */

function sendOrderWhatsApp() {
  if (!AppState.cart || AppState.cart.length === 0) { showToast('El carrito está vacío'); return; }
  const phone = String(AppState.config['WHATSAPP'] || AppState.config['Whatsapp'] || AppState.config['whatsapp'] || FALLBACKS.WHATSAPP).replace(/\D/g,'');
  const { items, subtotal, envio, total } = computeCartTotals();
  const lines = [];
  lines.push('*PEDIDO BEBU*');
  lines.push('');
  lines.push('*DETALLE DEL PEDIDO*');
  items.forEach(it => {
    lines.push(`• ${it.qty}x ${it.product.descripcion} - ${fmt(it.unitPrice)} c/u = ${fmt(it.subtotal)}`);
    if (it.promoApplied) lines.push(`  (Promo aplicada: ${it.promoApplied.cantidad} o más)`);
  });
  lines.push('');
  lines.push('*RESUMEN DE PAGO*');
  lines.push(`• Subtotal: ${fmt(subtotal)}`);
  if (envio) lines.push(`• Envío: ${fmt(envio)}`);
  lines.push(`• TOTAL: ${fmt(total)}`);
  lines.push('');
  lines.push('*FORMA DE ENTREGA*');
  lines.push(envio ? '• Envío a domicilio' : '• Retiro en local');
  lines.push('');
  lines.push('*FORMA DE PAGO*');
  lines.push('• Por acordar (indicar en el mensaje si es transferencia o efectivo)');
  lines.push('');
  lines.push('_¡Quedo atento a la confirmación del pedido!_');

  const text = encodeURIComponent(lines.join('\n'));
  const url = `https://wa.me/${phone}?text=${text}`;
  window.open(url, '_blank');

  // opcional: vaciar carrito después de enviar
  setTimeout(() => {
    AppState.cart = [];
    saveCartToStorage();
    renderCartDrawer();
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
  // header search
  const searchInput = el('buscador');
  if (searchInput) searchInput.addEventListener('input', e => handleSearchInput(e.target.value));

  // click delegation for brand / subcat / product buttons
  const appContainer = el('app-container');
  if (appContainer) {
    appContainer.addEventListener('click', e => {
      // brand card
      const brandCard = e.target.closest('.brand-card');
      if (brandCard) {
        const marca = brandCard.getAttribute('data-marca');
        renderSubcategories(marca);
        return;
      }
      // subcat card
      const subCard = e.target.closest('.subcat-card');
      if (subCard) {
        const sub = subCard.getAttribute('data-sub');
        const marcaLabel = (el('subcats-label') && el('subcats-label').textContent || '').replace(/^Líneas de\s*/, '').trim();
        // marcaSeleccionada se extrae del label; better to track selection globally if required
        const marca = marcaLabel || Object.keys(AppState.brands)[0] || '';
        // prefer to read marca from previous selection; but for simplicity assume last clicked brand
        renderProducts(currentSelectedBrand || marca, sub);
        return;
      }
      // product card buttons
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'add') addToCart(id, 1);
        else if (action === 'wa') {
          const p = AppState.products.find(pp => String(pp.id) === String(id));
          if (!p) return showToast('Producto no encontrado');
          const msg = `Hola! Me interesa: ${p.descripcion} - ${fmt(p.precio)}`;
          const phone = String(AppState.config['WHATSAPP'] || FALLBACKS.WHATSAPP).replace(/\D/g,'');
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
        return;
      }
    });
  }

  // brand keyboard accessibility
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // cerrar drawer si existe
      closeCartModal();
    }
  });

  // header cart open
  const cartBtn = el('btn-carrito-header');
  if (cartBtn) cartBtn.addEventListener('click', openCartModal);

  // modal close
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

  // cart modal delegation for qty changes
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

  // envio checkbox
  const envioToggle = el('switch-envio');
  if (envioToggle) envioToggle.addEventListener('change', () => {
    renderCartDrawer();
  });

  // enviar por whatsapp desde modal
  const sendBtn = el('btn-enviar-whatsapp');
  if (sendBtn) sendBtn.addEventListener('click', sendOrderWhatsApp);
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

let currentSelectedBrand = null;

async function bootstrap() {
  try {
    // logo inmediato fallback mientras carga
    const logoEl = el('logo-global');
    if (logoEl && logoEl.tagName === 'IMG') {
      logoEl.src = FALLBACKS.LOGO_LOCAL;
      logoEl.onerror = () => { logoEl.src = FALLBACKS.LOGO_LOCAL; };
    }

    loadCartFromStorage();
    bindUI();
    // show loading skeletons (simple)
    const brandsGrid = el('brands-grid');
    if (brandsGrid) brandsGrid.innerHTML = `<div class="loading"><div class="spinner"></div>Cargando...</div>`;

    const data = await loadAllData();
    // Assign to state
    AppState.products = data.productos || [];
    AppState.brands = (data.marcas || []).map(m => ({ marca: m.marca, logo: m.logo }));
    AppState.promos = data.promos || [];
    AppState.config = data.config || {};

    // apply theme and logo from config
    updateThemeFromConfig(AppState.config);

    // render initial
    renderBrands();
    updateCartCounter();

    // set click hooks for brand cards after first render
    // we need to setup delegation for selecting brand -> subcats -> products
    document.getElementById('brands-grid')?.addEventListener('click', e => {
      const card = e.target.closest('.brand-card');
      if (!card) return;
      const marca = card.getAttribute('data-marca');
      currentSelectedBrand = marca;
      renderSubcategories(marca);
    });
    // When a subcat is clicked, render products for currentSelectedBrand
    document.getElementById('subcats-grid')?.addEventListener('click', e => {
      const card = e.target.closest('.subcat-card');
      if (!card) return;
      const sub = card.getAttribute('data-sub');
      if (!currentSelectedBrand) {
        // infer marca from label if possible
        const label = el('subcats-label')?.textContent || '';
        currentSelectedBrand = label.replace(/^Líneas de\s*/, '').trim() || (AppState.brands[0] && AppState.brands[0].marca);
      }
      renderProducts(currentSelectedBrand, sub);
    });

    // final UI tune
    // If config has colors COLOR_1..COLOR_6 apply to CSS variables
    for (let i = 1; i <= 6; i++) {
      const key = `COLOR_${i}`;
      if (AppState.config[key]) document.documentElement.style.setProperty(`--color-${i}`, AppState.config[key]);
    }

  } catch (err) {
    console.error('Bootstrap error', err);
    const container = el('brands-grid');
    if (container) container.innerHTML = `<div class="empty-state"><div class="ei">⚠️</div><p>Error al cargar la tienda. Revisa la consola o la publicación del Sheet.</p></div>`;
  }
}

// Auto-run on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});