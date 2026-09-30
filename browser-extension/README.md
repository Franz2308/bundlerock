# BundleRock Downloader (Extensión de Navegador)

Extensión de navegador Manifest V3 para capturar enlaces y descargas instantáneas en **BundleRock** mediante un botón flotante incrustado sobre videos (estilo IDM) y el menú contextual (clic derecho).

---

## Características Principales

1. **Botón Flotante sobre Videos (Estilo IDM)**:
   - Aparece dinámicamente en la esquina de los reproductores al pasar el cursor o reproducir.
   - Completamente aislado mediante **Shadow DOM (closed)**: el CSS o scripts de las páginas no afectan su apariencia ni comportamiento.
   - **Extracción inteligente de enlaces**:
     - **TikTok**: Resuelve enlaces canónicos directos (`https://www.tiktok.com/@usuario/video/12345...`) incluso navegando en feeds `/foryou` o con el menú contextual bloqueado.
     - **Twitter / X**: Extrae el permalink limpio del post/tweet (`https://x.com/usuario/status/12345...`).
     - **YouTube**: Extrae el enlace limpio de videos, Shorts y reproductores incrustados.
     - **Facebook / Reels**: Localiza el reel o post asociado al reproductor.
     - **Reddit**: Detecta permalinks de posts en Shreddit / Reddit clásico y streams directos.
     - **Webs genéricas**: Detecta el stream de video o URL de página.
   - Feedback visual en tiempo real: Estados de envío ("Enviando a BundleRock..."), éxito ("¡Enviado a BundleRock!") y control de errores.

2. **Menú Contextual (Clic Derecho)**:
   - Haz clic derecho sobre cualquier enlace, video, audio o imagen y selecciona *"Descargar con BundleRock"*.

3. **Integración Directa con la App de Escritorio**:
   - Se comunica de forma segura con el servidor local de BundleRock (`127.0.0.1:18200/api/download`).
   - Trae la ventana principal a primer plano y activa el cuadro de diálogo de descarga inmediatamente.

---

## Instalación en Navegadores (Chrome, Edge, Brave, Opera)

1. Abre la página de extensiones de tu navegador:
   - **Google Chrome / Brave**: Escribe `chrome://extensions` en la barra de direcciones.
   - **Microsoft Edge**: Escribe `edge://extensions` en la barra de direcciones.
2. Activa el interruptor **"Modo de desarrollador"** (Developer mode) situado en la esquina superior derecha.
3. Haz clic en el botón **"Cargar descomprimida"** (Load unpacked).
4. Selecciona esta carpeta (`browser-extension`).

---

## Modo de Uso
1. **Botón Flotante**:
   - Pasa el cursor sobre un video en cualquier página web (YouTube, TikTok, Twitter/X, Facebook, etc.).
   - Haz clic en **"Descargar con BundleRock"**.
2. **Menú Contextual**:
   - Haz clic derecho sobre un enlace o reproductor y selecciona **"Descargar con BundleRock"**.

---

## Configuración
- Al hacer clic en el icono de la extensión en la barra de herramientas del navegador, verás el estado de conexión con el servidor local de BundleRock y podrás enviar enlaces manualmente.
- En la página de opciones puedes:
  - Personalizar el puerto del servidor local (por defecto `18200`).
  - Habilitar o deshabilitar el botón flotante sobre videos.
  - Configurar las notificaciones del sistema.
