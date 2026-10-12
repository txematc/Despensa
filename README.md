# Despensa compartida

Versión de la app Despensa que comparte el inventario entre dos personas mediante Supabase. Conserva categorías, cantidades, unidades, caducidades, filtros, edición, eliminación y exportación/importación JSON. Necesita internet para iniciar sesión y sincronizar los datos.

## Antes de empezar

1. **Guarda una copia de la versión anterior.** Conserva el ZIP anterior y, si la app vieja aún tiene productos en tu navegador, abre esa versión y pulsa «Exportar copia».
2. Crea una cuenta en [Supabase](https://supabase.com/) y crea un proyecto nuevo. Guarda la contraseña de la base de datos en un lugar seguro.
3. En el proyecto Supabase, abre **SQL Editor**, crea una consulta nueva, copia todo el contenido de `supabase-schema.sql` y pulsa **Run**.
4. En Supabase, abre **Project Settings / API** (el nombre de la sección puede variar). Copia la **Project URL** y la clave pública **anon** o **publishable**.
5. Abre `supabase-config.js` con un editor de texto. Sustituye `PEGA_AQUI_LA_URL_DE_TU_PROYECTO` por la URL y `PEGA_AQUI_TU_CLAVE_PUBLICA_ANON` por la clave pública. Guarda el archivo.
   - No uses nunca la clave `service_role` ni una clave secreta en archivos que se publican en internet.
6. En Supabase, revisa **Authentication > URL Configuration** y añade la URL publicada de la app a **Site URL** y a las **Redirect URLs** si el panel te lo solicita. Para GitHub Pages sería algo como `https://TU-USUARIO.github.io/despensa/`.
7. Publica todos los archivos de esta carpeta en tu repositorio de GitHub Pages, incluida la carpeta `icons`, `supabase-config.js` y `supabase-schema.sql`. No publiques el archivo de configuración hasta que hayas puesto tus claves públicas.
8. Abre la URL publicada. Crea tu cuenta con correo y contraseña. Si Supabase exige confirmar el correo, abre el mensaje de confirmación y vuelve a iniciar sesión.
9. Pulsa **Crear despensa y generar invitación**. Se mostrará un código.
10. Tu pareja abre la misma URL, crea su propia cuenta y escribe el código en **Código de invitación** para unirse a la despensa existente.

## Importar el inventario que ya tenías

La versión antigua guardaba los productos en el navegador; no estaban en un servidor. Por eso la nueva base de datos no puede recuperarlos automáticamente desde otro móvil.

- En el mismo navegador donde usabas la versión antigua, la app nueva detectará los productos locales y mostrará **Importar productos de esta versión del dispositivo**. Púlsalo una sola vez y confirma.
- Si ya exportaste un JSON, usa **Importar copia JSON**.
- Antes de importar, comprueba si los productos ya existen en la despensa compartida para evitar duplicados.

## Seguridad y funcionamiento

- Cada persona tiene su propia cuenta; el código de invitación permite unirse a la misma despensa.
- Las políticas de seguridad de la base de datos limitan el acceso a los miembros de esa despensa. Comparte el código solo con tu pareja.
- La clave pública de Supabase es visible en el navegador por diseño; la seguridad depende de las políticas RLS incluidas en el SQL. Nunca añadas una clave `service_role` a la aplicación.
- Ambos pueden añadir, editar y eliminar productos. Los cambios se actualizan en tiempo real cuando hay conexión.
- El modo sin conexión solo puede mostrar la interfaz almacenada en caché; las modificaciones requieren internet.
- Exporta periódicamente una copia JSON como respaldo.

## Archivos importantes

- `index.html`, `styles.css`, `app.js`: interfaz y lógica de la aplicación.
- `supabase-config.js`: URL y clave pública del proyecto (debes configurarlo).
- `supabase-schema.sql`: tablas, funciones y permisos de la base de datos.
- `manifest.webmanifest`, `service-worker.js`, `icons/`: instalación como aplicación web progresiva.
