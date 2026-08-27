export const SHEET_ID = '1JBnOCILUFaXuWIgUJGOZYPXKV-nQdOTfAXw2voUnKd8';

export const SHEETS = {
  PRODUCTOS: { name: 'Productos', gid: '1022185098' },
  MARCAS: { name: 'Marcas', gid: '1283244979' },
  CONFIG: { name: 'Config', gid: '340621461' },
  PROMOCIONES: { name: 'Promociones', gid: '718207796' }
};

export const SHEET_TTL_MS = 60 * 1000;
export const CACHE_VERSION = 'v7';

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
    subtitle: 'Pampers · Huggies · Babysec · Duffy · Estrella',
    accent: 'var(--accent-1)',
    size: 'hero',
    motif: 'panales',
    marcas: ['PAMPERS', 'HUGGIES', 'BABYSEC', 'DUFFY', 'ESTRELLA'],
    excludeSubcat: /toalla|algodon|oleo|óleo/i
  },
  {
    id: 'algodon-oleo',
    title: 'Algodones & Óleo',
    subtitle: '',
    accent: 'var(--accent-3)',
    size: 'primary',
    motif: 'algodones',
    marcas: ['ESTRELLA'],
    matchSubcat: /algodon|oleo|óleo/i,
    directProducts: true
  },
  {
    id: 'toallas',
    title: 'Toallas',
    subtitle: '',
    accent: 'var(--accent-2)',
    size: 'primary',
    motif: 'toallas',
    matchSubcat: /toalla/i,
    directProducts: true
  }
];

export const LS = {
  CART: 'bebu:cart:v2',
  SHEET_CACHE: `bebu:sheetcache:${CACHE_VERSION}`
};
