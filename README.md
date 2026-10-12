# Despensa

Aplicación web progresiva (PWA) para inventario doméstico.

## Archivos

- `index.html`: estructura de la aplicación.
- `styles.css`: diseño adaptable a móvil y escritorio.
- `app.js`: alta, consulta, edición, eliminación, filtros, exportación e importación.
- `manifest.webmanifest`: nombre, iconos y opciones de instalación.
- `service-worker.js`: caché para funcionamiento básico sin conexión.
- `icons/`: icono vectorial y los iconos PNG de la aplicación.

## Probar en un ordenador

La app guarda datos en el `localStorage` del navegador. Para que funcione también el service worker, sirve la carpeta desde `localhost` o desde una web HTTPS.

Con Python instalado, abre una terminal dentro de esta carpeta y ejecuta:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000` en el navegador.

También puedes utilizar cualquier servidor estático local equivalente. Abrir `index.html` directamente con doble clic permite probar las funciones principales, pero no activa el service worker ni la instalación PWA.

## Instalar en el móvil

Para instalar la PWA, publica toda esta carpeta en un alojamiento web HTTPS. Puede utilizarse un alojamiento estático gratuito, por ejemplo GitHub Pages, Cloudflare Pages o Netlify.

- **Android (Chrome):** abre la URL HTTPS y usa el menú del navegador, opción «Instalar aplicación» o «Añadir a pantalla de inicio».
- **iPhone (Safari):** abre la URL HTTPS, pulsa Compartir y elige «Añadir a pantalla de inicio».

La instalación exacta depende del navegador y su versión.

## Datos y copias de seguridad

Los productos se guardan en el almacenamiento local del navegador en ese dispositivo y perfil. No hay cuenta, servidor ni sincronización automática. Borrar los datos del navegador puede borrar el inventario.

Pulsa «Exportar copia» para descargar un archivo JSON. Para restaurarlo, pulsa «Importar copia» y selecciona ese archivo. La importación sustituye el inventario actual, previa confirmación.

## Funcionamiento sin conexión

Después de visitar la app por primera vez desde una URL HTTPS, el service worker guarda los archivos principales para que la interfaz pueda abrirse sin conexión. Los datos se guardan en el almacenamiento local del navegador.

## Iconos PNG

Los iconos `icons/icon-192.png` y `icons/icon-512.png` se incluyen en el paquete. El archivo `icons/icon.svg` es la versión vectorial de referencia.
