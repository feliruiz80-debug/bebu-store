# BEBU Store

Catálogo PWA que lee un Google Sheet y arma el pedido por WhatsApp.

## Local

```bash
npm install
npm run dev
```

Build para Vercel: `npm run build` (salida en `dist/`).

El Sheet tiene que estar **publicado para la web** (Archivo → Compartir → Publicar en la web) o con acceso “cualquiera con el enlace”.

## Pestañas y columnas

- **Productos:** `ID`, `MARCA`, `SUBCATEGORIA`, `DESCRIPCION`, `PRECIO`, `URL IMAGEN`
- **Marcas:** `MARCA`, `URL LOGO`
- **Config:** `CLAVE`, `VALOR` (`URL_LOGO_APP`, `WHATSAPP`, `COSTO_ENVIO`, `COLOR_1` … `COLOR_6`)
- **Promociones:** `ID PROMO`, `ID PRODUCTO`, `CANTIDAD`, `PRECIO UNIDAD`, `PRECIO PROMO`, `ACTIVO`

IDs de producto tipo `001` / `008`. `ACTIVO` usa `SI` o `NO`. `PRECIO PROMO` es el total del pack (`CANTIDAD × PRECIO UNIDAD`).
