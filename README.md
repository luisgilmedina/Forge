# FocusForge para OPPO Pad · proyecto Android beta 0.8

## Mejoras de esta versión

- Admite Excel `.xlsx` sin IA: lee localmente los valores guardados de las primeras tres hojas y hasta 120 filas por hoja. No evalúa fórmulas y las fechas pueden aparecer como números. Para Access `.accdb` / `.mdb` y el antiguo `.xls`, exporta la tabla a CSV antes de subirla. Máximo 2 MB por `.xlsx`.
- Permite configurar la API de OpenAI y Gemini por separado, o solo una de ellas. OpenAI (modelo `gpt-4.1-mini`) genera texto, lecciones, esquemas y exámenes; Gemini también extrae contenido de PDF e imágenes. En Ajustes se elige el proveedor de texto; si solo hay una clave disponible, se usa esa para tareas compatibles. No cambia de proveedor tras un error de cuota sin que tú lo elijas.
- La clave de OpenAI se guarda cifrada en Android Keystore y las llamadas se hacen desde Android, sin incluir la clave en JavaScript, el ZIP, GitHub ni las copias. No se debe poner una clave de API en una app pública sin infraestructura de servidor. Esta versión está prevista para uso personal: alguien que tenga la tablet desbloqueada puede consumir tu saldo de la API.
- Tener ChatGPT Plus no habilita ni paga por sí mismo la API de OpenAI. La integración automática de OpenAI requiere una clave API activa y puede incurrir en cargos independientes. FocusForge no recibe tu contraseña de ChatGPT.
- En «Lección» se pregunta si quieres un esquema. Si aceptas, la IA lo organiza en apartados y puntos a partir del material seleccionado; se guarda con la lección y puede actualizarse después. «Ahora no» permite seguir sin generar nada.
- Temporizador con pausa y reanudación; durante la pausa el tiempo no avanza ni se suman recompensas. Mantiene el recálculo al volver a abrir la aplicación. El reloj del sistema sigue siendo la referencia: un cambio manual de hora puede afectar el resultado; no se verifica que se haya estudiado físicamente.
- Reto diario voluntario de 25 minutos en el Panel. La mascota empieza como un huevo y, al acumular 25 minutos completados, nace un perrito o un gatito al azar. Sus necesidades varían suavemente con los días, sin enfermedad ni desaparición. Comer, beber y jugar siguen costando minutos completados.
- Exámenes con enunciados de comprensión, aplicación y detección de errores, distractores plausibles y explicación respaldada por los apuntes. Siguen siendo pruebas de opción múltiple generadas por IA, sujetas a revisión humana.
- Videolección de ideas animadas con narración opcional, inspirada en el formato de resúmenes multimedia; se reproduce dentro de FocusForge y **no exporta un MP4 ni un vídeo descargable**. El audio y las diapositivas no están sincronizados palabra a palabra.
- La conexión automática a Gemini mediante la cuenta de Google no está incluida. La clave se introduce una vez en Ajustes y, por defecto en el APK Android, se guarda cifrada con AES-256-GCM y una clave protegida por Android Keystore. Se puede desactivar «Recordar» o pulsar «Quitar clave». No se incluye en el código fuente, GitHub ni las copias JSON.
- Ahora admite hasta 20 materiales en el dispositivo; cada uno conserva hasta 35.000 caracteres de texto. La copia importable admite hasta 5 MB. El espacio real depende del almacenamiento libre de la tablet y del WebView; si se agota, la app informa y no añade el material.
- Nueva sección «Lección»: selecciona un material, genera con la API configurada un resumen visual, tarjetas y un guion narrado. La voz de Android lee el guion dentro de la aplicación; no crea ni descarga un archivo MP3. Requiere una voz en español disponible en el dispositivo.
- Bienvenida en el primer inicio, guía de tres pasos en el Panel y ayuda accesible desde «Cómo empezar». El botón principal cambia según el progreso para mostrar qué hacer a continuación.
- La Sala de exámenes acepta texto, CSV y XLSX sin IA para extracción, PDF e imagen con Gemini. Con OpenAI o Gemini conectado genera preguntas; al corregir, guarda cada fallo como tarjeta y solicita a la IA una explicación y una práctica breve. Si esa consulta falla, la tarjeta conserva la respuesta y la explicación del examen.
- Subida de archivos desde el Panel inicial; se crea una guía para la asignatura y un plan de estudio de 25 minutos. Con una clave Gemini opcional se puede generar y guardar una guía más específica basada en los apuntes.
- Nueva sección Mascota: jardín animado, crecimiento por minutos de estudio completados y acciones de comida (10 min), agua (5 min) y juego (15 min). Las acciones gastan únicamente el saldo obtenido al completar bloques; detener un bloque antes de tiempo no concede minutos.
- Los datos de la mascota y los planes de IA se incluyen en la copia de seguridad. Las copias anteriores siguen siendo importables.
- Esta versión no incorpora bloqueo de pantalla ni vigilancia del dispositivo.

**Actualización desde un APK de depuración anterior:** una nueva compilación de GitHub Actions puede llevar una firma distinta. Exporta primero tu copia desde Ajustes. Si Android no permite instalar encima, desinstala la versión anterior, instala el nuevo APK e importa la copia. Desinstalar sin exportar borra los datos locales.

**ESTE ZIP ES CÓDIGO FUENTE, NO ES UN APK.** Se entrega un proyecto de Android Studio, junto con una tarea de GitHub Actions para crear automáticamente un APK de prueba. En el entorno utilizado para preparar los archivos no hay Android SDK, Gradle ni acceso a sus repositorios, por lo que **no se ha podido generar ni instalar un APK real**. No presentes este ZIP como una aplicación lista para instalar.

## Qué incluye realmente

- APK nativo al compilar, con icono propio e interfaz táctil de FocusForge que se distribuye **dentro del APK**: sin Netlify ni ninguna dirección web.
- Cronómetro y rutinas (recalcula la duración al volver a abrir), experiencia XP, monedas, avatar, materiales de texto, tarjetas de repaso, exportación/importación de copias mediante selector de archivos de Android.
- Consultas y exámenes con OpenAI o Gemini **solo con una clave API configurada y conexión**. PDF e imágenes necesitan Gemini para extracción. No se incluye ninguna clave. No se ha verificado este servicio desde una tablet real.
- La interfaz local se carga como HTTPS sintético con `androidx.webkit.WebViewAssetLoader` desde los assets empaquetados para permitir APIs seguras y guardar datos por origen en WebView.
- No requiere permiso de acceso general al almacenamiento: se usa el selector de archivos de Android. El único permiso declarado es `INTERNET`.

**Limitaciones:** no bloquea otras apps, notificaciones, el móvil ni todo Android. No controla físicamente el tiempo de estudio ni verifica que se estudie. No hay alertas fiables con la app cerrada. La clave Gemini se descifra en memoria al abrir la app para hacer consultas; alguien con acceso a la app desbloqueada podría utilizarla. Una reinstalación puede eliminar el secreto local y exigir introducirlo de nuevo. Las copias deben guardarse de forma manual. El nombre comercial de la tablet no determina su versión de Android: configuración con mínimo Android 8.0/API 26, pero la compatibilidad en el modelo exacto de OPPO no está ensayada.

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

## ChatGPT sin API (0.9)

En Lección o Exámenes elige un material, pulsa «Copiar petición», pega en ChatGPT y pega la respuesta JSON en FocusForge. Genera lecciones, esquemas y exámenes sin clave API; requiere pasos manuales. Para leer PDF o imágenes dentro de FocusForge sigue haciendo falta Gemini. El material solo se comparte con ChatGPT al pegarlo allí.
