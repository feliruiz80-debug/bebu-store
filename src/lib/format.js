const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
});

export function fmt(v) {
  return currency.format(Math.round(v || 0));
}

export function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s === '') return null;
  s = s.replace(/\s/g, '').replace(/^\$/, '').replace(/ARS/i, '');
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

export function padProductId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return s.padStart(3, '0');
  return s;
}

export function idsMatch(a, b) {
  return padProductId(a) === padProductId(b);
}

export function isTruthyFlag(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return s === 'si' || s === 'true' || s === '1' || s === 'x' || s === 'yes' || raw === true;
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/'/g, '&#39;');
}

export function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function pick(row, ...keys) {
  for (const key of keys) {
    const n = normalizeHeader(key);
    if (row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== '') {
      return row[n];
    }
  }
  return '';
}
