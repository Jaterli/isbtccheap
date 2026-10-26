# Imagen para redes sociales

`og-image.html` es la plantilla de `public/og-es.png` y `public/og-en.png` (1200×630), las imágenes que aparecen al
compartir la web en X, LinkedIn, WhatsApp, etc. (`og:image` en `src/i18n/meta.ts`). Esta carpeta no se publica.

Para regenerarlas tras cambiar el diseño, sirve la raíz del proyecto (la plantilla usa `../../assets/logo.jpg`) y haz
una captura de 1200×630 de cada idioma, por ejemplo con Chrome:

```bash
python3 -m http.server 8765 --bind 127.0.0.1   # desde la raíz del proyecto
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 \
  --screenshot=web/public/og-es.png "http://localhost:8765/web/og/og-image.html?lang=es"
# y lo mismo con lang=en → og-en.png
```

Las redes guardan en caché la imagen de cada enlace: para ver el cambio, usa sus herramientas de depuración
(Facebook Sharing Debugger, LinkedIn Post Inspector).
