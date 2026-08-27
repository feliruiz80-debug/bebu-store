import { SHEET_ID, SHEETS, SHEET_TTL_MS, LS } from '../config.js';
import { normalizeHeader, parsePrice, padProductId, isTruthyFlag, pick } from './format.js';

function parseCsv(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    if (row.some((c) => String(c).trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushCell();
    } else if (c === '\n') {
      pushCell();
      pushRow();
    } else if (c === '\r') {
      continue;
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    pushCell();
    pushRow();
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h || `col${i}`] = r[i] ?? '';
    });
    return obj;
  });
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(LS.SHEET_CACHE);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > SHEET_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function setCached(key, data) {
  try {
    const raw = localStorage.getItem(LS.SHEET_CACHE);
    const store = raw ? JSON.parse(raw) : {};
    store[key] = { ts: Date.now(), data };
    localStorage.setItem(LS.SHEET_CACHE, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (/^<!doctype html/i.test(text) || text.includes('google-signin')) {
    throw new Error('Sheet no publicado o no accesible');
  }
  return text;
}

export async function fetchSheetTab(tab) {
  const cacheKey = `tab:${tab.name}:${tab.gid}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const urls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}&headers=1`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${tab.gid}&headers=1`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      const objects = rowsToObjects(parseCsv(text));
      setCached(cacheKey, objects);
      return objects;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`No se pudo leer ${tab.name}`);
}

export function mapProductos(rows) {
  return rows
    .map((r) => ({
      id: padProductId(pick(r, 'id')),
      marca: String(pick(r, 'marca', 'brand')).trim().toUpperCase(),
      subcategoria: String(pick(r, 'subcategoria', 'category', 'subcat') || 'GENERAL').trim(),
      descripcion: String(pick(r, 'descripcion', 'description')).trim(),
      precio: parsePrice(pick(r, 'precio', 'price')) || 0,
      imagen: String(pick(r, 'url_imagen', 'url_imagen_producto', 'image', 'imagen')).trim()
    }))
    .filter((p) => p.id && p.descripcion);
}

export function mapMarcas(rows) {
  return rows
    .map((r) => ({
      marca: String(pick(r, 'marca', 'name')).trim().toUpperCase(),
      logo: String(pick(r, 'url_logo', 'logo', 'url', 'imagen')).trim()
    }))
    .filter((m) => m.marca);
}

export function mapConfig(rows) {
  const config = {};
  for (const r of rows) {
    const clave = String(pick(r, 'clave', 'key') || r[Object.keys(r)[0]] || '').trim();
    const valor = pick(r, 'valor', 'value', 'val');
    const v = valor !== '' ? valor : r[Object.keys(r)[1]] ?? '';
    if (clave) config[clave] = v;
  }
  return config;
}

export function mapPromos(rows) {
  return rows
    .map((r) => {
      const cantidad = parseInt(pick(r, 'cantidad', 'qty'), 10) || 0;
      const precioUnidad = parsePrice(
        pick(r, 'precio_unidad', 'precio unitario', 'precio de unidad', 'precio_unidad_promo')
      );
      const precioPromo = parsePrice(
        pick(r, 'precio_promo', 'precio promo', 'precio pack', 'precio_pack')
      );
      return {
        id_promo: String(pick(r, 'id_promo', 'idpromo')).trim(),
        id_producto: padProductId(pick(r, 'id_producto', 'idproducto', 'product_id')),
        cantidad,
        precio_unidad: precioUnidad,
        precio_promo: precioPromo,
        activo: isTruthyFlag(pick(r, 'activo', 'active'))
      };
    })
    .filter((p) => p.id_producto);
}

export async function loadAllData() {
  const errors = {};
  const [productosRes, marcasRes, configRes, promosRes] = await Promise.allSettled([
    fetchSheetTab(SHEETS.PRODUCTOS),
    fetchSheetTab(SHEETS.MARCAS),
    fetchSheetTab(SHEETS.CONFIG),
    fetchSheetTab(SHEETS.PROMOCIONES)
  ]);

  const take = (res, key) => {
    if (res.status === 'fulfilled') return res.value;
    errors[key] = res.reason?.message || 'Error';
    console.error(`[Sheet ${key}]`, res.reason);
    return [];
  };

  return {
    productos: mapProductos(take(productosRes, 'Productos')),
    marcas: mapMarcas(take(marcasRes, 'Marcas')),
    config: mapConfig(take(configRes, 'Config')),
    promos: mapPromos(take(promosRes, 'Promociones')),
    errors
  };
}

export function promoDisplayPrice(promo, listPrice = 0) {
  if (!promo || !promo.activo) return null;
  if (promo.precio_promo != null) return promo.precio_promo;
  if (promo.precio_unidad != null && promo.cantidad > 0) {
    return promo.precio_unidad * promo.cantidad;
  }
  return listPrice;
}

export function linePrice(qty, listPrice, promo) {
  if (!promo || !promo.activo || !promo.cantidad || qty < promo.cantidad) {
    return { unitPrice: listPrice, subtotal: listPrice * qty, promoApplied: null };
  }
  const packs = Math.floor(qty / promo.cantidad);
  const rest = qty % promo.cantidad;
  const packTotal =
    promo.precio_promo != null
      ? promo.precio_promo
      : (promo.precio_unidad || listPrice) * promo.cantidad;
  const unitInPromo =
    promo.precio_unidad != null ? promo.precio_unidad : packTotal / promo.cantidad;
  const subtotal = packs * packTotal + rest * listPrice;
  return {
    unitPrice: rest === 0 ? unitInPromo : listPrice,
    subtotal,
    promoApplied: promo,
    packs,
    rest
  };
}
