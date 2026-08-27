export const SHEET_ID = '1JBnOCILUFaXuWIgUJGOZYPXKV-nQdOTfAXw2voUnKd8';

export const SHEETS = {
  PRODUCTOS: { name: 'Productos', gid: '1022185098' },
  MARCAS: { name: 'Marcas', gid: '1283244979' },
  CONFIG: { name: 'Config', gid: '340621461' },
  PROMOCIONES: { name: 'Promociones', gid: '718207796' }
};

export const SHEET_TTL_MS = 60 * 1000;
export const CACHE_VERSION = 'v2';

export const FALLBACKS = {
  WHATSAPP: '543517604762',
  COSTO_ENVIO: 2500,
  LOGO_LOCAL: '/logo.png'
};

/** Home sections: Pañales hero; Algodones & Toallas equal size. */
export const HOME_SECTIONS = [
  {
    id: 'panales',
    title: 'Pañales',
    subtitle: 'Lo más elegido · Pampers · Huggies · Babysec · Duffy · Estrella',
    accent: 'var(--accent-1)',
    size: 'hero',
    motif: 'panales',
    marcas: ['PAMPERS', 'HUGGIES', 'BABYSEC', 'DUFFY', 'ESTRELLA']
  },
  {
    id: 'algodon-oleo',
    title: 'Algodones & Óleo',
    subtitle: 'Estrella',
    accent: 'var(--accent-3)',
    size: 'primary',
    motif: 'algodones',
    marcas: ['ESTRELLA']
  },
  {
    id: 'toallas',
    title: 'Toallas',
    subtitle: 'Húmedas y cuidado',
    accent: 'var(--accent-2)',
    size: 'primary',
    motif: 'toallas',
    matchSubcat: /toalla/i
  }
];

const PANALES_MARCAS = new Set(['PAMPERS', 'HUGGIES', 'BABYSEC', 'DUFFY']);
/** Estrella Premium / Híper Pack / Súper Pack are diapers, not algodón. */
const ESTRELLA_PANALES_SUBCAT = /^(PREMIUM|HIPERPACK|SUPERPACK)$/i;
const ESTRELLA_ALGODON_OLEO_SUBCAT = /^(ALGODON|OLEOS)$/i;

export function productMatchesSection(product, section) {
  const sub = String(product.subcategoria || '').trim();
  const marca = product.marca;

  if (section.id === 'toallas') return /toalla/i.test(sub);

  if (section.id === 'panales') {
    if (/toalla/i.test(sub)) return false;
    if (PANALES_MARCAS.has(marca)) return true;
    if (marca === 'ESTRELLA' && ESTRELLA_PANALES_SUBCAT.test(sub)) return true;
    return false;
  }

  if (section.id === 'algodon-oleo') {
    if (/toalla/i.test(sub)) return false;
    return marca === 'ESTRELLA' && ESTRELLA_ALGODON_OLEO_SUBCAT.test(sub);
  }

  if (section.matchSubcat) return section.matchSubcat.test(sub);
  if (section.marcas?.length && !section.marcas.includes(marca)) return false;
  if (section.excludeSubcat?.test(sub)) return false;
  return true;
}

export const LS = {
  CART: 'bebu:cart:v2',
  SHEET_CACHE: `bebu:sheetcache:${CACHE_VERSION}`
};
