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

export const LS = {
  CART: 'bebu:cart:v2',
  SHEET_CACHE: `bebu:sheetcache:${CACHE_VERSION}`
};
