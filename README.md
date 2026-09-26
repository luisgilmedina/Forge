# FocusForge para OPPO Pad · proyecto Android beta 0.3

**ESTE ZIP ES CÓDIGO FUENTE, NO ES UN APK.** Se entrega un proyecto de Android Studio, junto con una tarea de GitHub Actions para crear automáticamente un APK de prueba. En el entorno utilizado para preparar los archivos no hay Android SDK, Gradle ni acceso a sus repositorios, por lo que **no se ha podido generar ni instalar un APK real**. No presentes este ZIP como una aplicación lista para instalar.

## Qué incluye realmente

- APK nativo al compilar, con icono propio e interfaz táctil de FocusForge que se distribuye **dentro del APK**: sin Netlify ni ninguna dirección web.
- Cronómetro y rutinas (recalcula la duración al volver a abrir), experiencia XP, monedas, avatar, materiales de texto, tarjetas de repaso, exportación/importación de copias mediante selector de archivos de Android.
- Consultas de IA, análisis de PDF e imágenes y creación de exámenes **solo si el usuario configura su propia clave de Gemini y tiene conexión**. No se incluye ninguna clave. No se ha verificado este servicio desde una tablet real.
- La interfaz local se carga como HTTPS sintético con `androidx.webkit.WebViewAssetLoader` desde los assets empaquetados para permitir APIs seguras y guardar datos por origen en WebView.
- No requiere permiso de acceso general al almacenamiento: se usa el selector de archivos de Android. El único permiso declarado es `INTERNET`.

**Limitaciones:** no bloquea otras apps, notificaciones, el móvil ni todo Android. No controla físicamente el tiempo de estudio ni verifica que se estudie. No hay alertas fiables con la app cerrada. La clave Gemini queda en memoria de la página mientras esta esté abierta y las consultas se envían al proveedor al solicitarlo. Las copias deben guardarse de forma manual. El nombre comercial de la tablet no determina su versión de Android: configuración con mínimo Android 8.0/API 26, pero la compatibilidad en el modelo exacto de OPPO no está ensayada.

## Método A: crear el APK con GitHub (sin instalar Android Studio)

1. Descomprime todo este archivo ZIP desde un ordenador. Presta atención a la carpeta oculta `.github/`, que contiene el flujo de compilación.
2. En https://github.com/new crea un repositorio **privado**, por ejemplo `focusforge-oppo`, con rama `main`. No compartas tus claves Gemini ni datos reales: aquí solo hay código y recursos estáticos.
3. En la página del repositorio, pulsa **Add file → Upload files** y arrastra **el contenido interior** de la carpeta descomprimida (incluidos `.github/` y `app/`) a la raíz. Si tu navegador no permite incluir `.github/` como carpeta oculta, crea manualmente `.github/workflows/compilar-apk.yml` pegando el archivo incluido. Al terminar, comprueba que están en la raíz `settings.gradle`, `build.gradle`, `app/`, `.github/`.
4. En **Actions**, elige **Compilar FocusForge APK** y pulsa **Run workflow** (si ya se ejecutó con el primer `push`, abre esa ejecución). Espera el resultado. En la sección **Artifacts** descarga `FocusForge-OPPO-APK`, descomprímelo y obtendrás `app-debug.apk`.
5. Copia el APK a la tablet OPPO. Ábrelo con Archivos/Files. Android puede solicitar permiso para instalar aplicaciones desde esa fuente: autoriza la instalación para ese gestor de archivos y, después, vuelve a desactivarlo si lo prefieres. No ignores alertas de protección si el origen no es confiable.

El archivo de GitHub Actions usa JDK 17, Gradle 8.11.1, AGP 8.9.2, Android SDK 35 y AndroidX WebKit 1.12.1. Los servicios externos deben estar disponibles para que compile. **No se ha ejecutado este flujo en una cuenta real.**

**ATENCIÓN A LAS ACTUALIZACIONES:** cada ejecución de GitHub Actions puede generar una clave de firma de depuración diferente. Es posible que Android rechace instalar un segundo APK encima del anterior. Antes de eliminar una instalación existente, exporta tus datos a JSON desde Ajustes para no perder tus avances. Para distribuir una versión definitiva y actualizable, configura una **clave de firma privada estable**; no subas su contraseña al repositorio.

## Método B: Android Studio

1. Descarga Android Studio en un ordenador compatible; abre esta carpeta como proyecto Android.
2. Deja que sincronice dependencias de internet. Si te pide instalar el SDK API 35 y las herramientas Build Tools 35.0.0, acepta.
3. En el menú de compilación, selecciona **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Encontrarás el APK de depuración en `app/build/outputs/apk/debug/app-debug.apk`.
4. Instálalo en la tablet como se describe arriba.

## Seguridad y funcionamiento

- Solo el contenido empaquetado bajo `https://appassets.androidplatform.net/assets/www/` se abre dentro del WebView. Los enlaces HTTPS externos se abren en otra aplicación. No se habilita el acceso desde `file://`.
- `saveBackup` se ofrece a la página local mediante `@JavascriptInterface`, comprueba el formato antes de mostrar el selector y deja que el usuario elija el destino.
- Los datos normales se guardan en el almacén local de **esta aplicación**, separado del Chrome de la tablet y del Chromebook. No se sincronizan. Si ya usabas FocusForge, exporta la copia JSON de la versión anterior e impórtala en Ajustes.
- No hay compras, publicidad, registro de cuenta, seguimiento, permisos de accesibilidad ni políticas de administrador del dispositivo.

## Pruebas que puedes realizar tras compilar

1. Abre FocusForge sin conexión: Panel, cronómetro, XP y tarjetas deben cargar.
2. Añade una tarea de un minuto, iníciala, cambia de pantalla, espera y vuelve: debe actualizarse el tiempo.
3. Añade notas `.txt` con el selector de archivos de Android.
4. En Ajustes, exporta una copia JSON, luego impórtala y verifica los datos.
5. Con conexión y tu clave privada, prueba **Probar IA**. Nunca compartas la clave en incidencias ni capturas.

**Documentación técnica:**
- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- https://developer.android.com/build/building-cmdline
- https://developer.android.com/build/releases/agp-8-9-0-release-notes
- https://developer.android.com/distribute/marketing-tools/alternative-distribution
