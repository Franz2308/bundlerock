# BundleRock

Gestor de descargas acelerado y extractor multimedia para Windows, desarrollado con Tauri 2, Rust y React.

---

## Descripción General

BundleRock es una aplicación de escritorio de alto rendimiento orientada a la gestión y aceleración de transferencias de archivos en entornos Windows. Inspirada en la arquitectura técnica de los gestores tradicionales como Internet Download Manager (IDM), combina un motor de segmentación dinámica multihilo implementado en Rust con un subsistema extractor multimedia basado en `yt-dlp` y `FFmpeg`.

Su interfaz de usuario prioriza la sobriedad, la densidad de información y la estética clásica Win32, ofreciendo control exhaustivo sobre las conexiones, formatos y organización de las descargas.

---

## Características Principales

### Motor de Descarga Acelerada
* **Segmentación Dinámica Concurrente:** División automática de archivos en múltiples conexiones paralelas (4, 8, 16 o 32 hilos) mediante peticiones HTTP `Range`, maximizando el aprovechamiento del ancho de banda disponible.
* **Sondeo Preliminar (Probe):** Inspección remota de cabeceras (`Accept-Ranges`, `Content-Length`, `Content-Disposition`, `ETag`) antes de iniciar la transferencia para determinar la viabilidad de la descarga acelerada y el tamaño exacto del recurso.
* **Escritura Eficiente:** Manejo asíncrono de escritura en disco a través de Tokio, evitando bloqueos en la interfaz y minimizando tiempos de ensamblado.

### Extracción Multimedia y Redes Sociales
* **Soporte de Plataformas:** Descarga de transmisiones desacopladas (audio y video) desde YouTube, Twitter/X, Facebook y Reddit.
* **Conversión Automática de GIFs de Twitter:** Detección de flujos de video en bucle y remuxing a formato `.gif` de alta calidad con paleta optimizada mediante FFmpeg.
* **Selección Multiformato:** Capacidad para seleccionar simultáneamente múltiples resoluciones o variantes de un mismo recurso, generando tareas independientes con nombres diferenciados.
* **Mecanismo de Respaldo (Stream Fallback):** Si las dependencias de multiplexado no se encuentran disponibles, el sistema conmuta automáticamente a flujos pre-ensamblados para garantizar que el archivo resultante contenga audio y video integrados.

### Interfaz de Usuario y Experiencia
* **Estructura Jerárquica en Árbol:** Visualización de descargas multivariante agrupadas con nodos expandibles estilo Windows Explorer.
* **Visualización Dual:** Soporte para alternar entre vista detallada (tabla con métricas completas de tamaño, velocidad y estado) y vista compacta (tarjetas responsivas con diseño uniforme).
* **Confirmación Configurable:** Notificación preventiva ante descargas múltiples de un mismo enlace, con persistencia de preferencia para suprimir advertencias futuras.
* **Barra de Título Integrada:** Encabezado con controles de ventana personalizados (minimizar, maximizar, restaurar y cierre inmediato) con soporte nativo de arrastre.
* **Portapapeles Automático:** Lectura directa del portapapeles mediante integración nativa para autocompletar enlaces al abrir el cuadro de diálogo de nueva descarga.

### Gestión y Persistencia
* **Persistencia de Tareas:** Serialización automática del estado del gestor en almacenamiento local (`tasks.json` en `AppData`), preservando el historial entre reinicios del programa.
* **Política de Conservación:** La eliminación de registros del historial no destruye los archivos descargados en el almacenamiento físico a menos que se solicite de forma explícita.
* **Auto-Aprovisionamiento de Dependencias:** Detección automática en el primer arranque y descarga transparente en segundo plano de los binarios requeridos (`yt-dlp` y `FFmpeg`) en `%APPDATA%\BundleRock\bin`.

---

## Tecnologías Utilizadas

* **Capa Nativa (Backend):**
  * Rust (edición 2021)
  * Tauri v2
  * Tokio (Entorno de ejecución asíncrono)
  * Reqwest (Cliente HTTP con soporte de streaming)
  * Zip (Descompresión de binarios en memoria)
  * Tauri Plugin Clipboard Manager (Acceso seguro al portapapeles)

* **Capa de Presentación (Frontend):**
  * React 19
  * TypeScript
  * Vite
  * Tailwind CSS v4
  * Lucide React (Iconografía vectorial)

---

## Estructura del Repositorio

```text
bundlerock/
├── src/
│   ├── components/            # Componentes de interfaz (TitleBar, Toolbar, Modales, Vistas)
│   ├── services/              # Cliente IPC de comunicación con el backend Tauri
│   ├── types/                 # Definiciones de tipos TypeScript y modelos de datos
│   ├── utils/                 # Utilidades de formato de bytes, velocidad y clasificación
│   └── App.tsx                # Orquestador principal de estado y eventos
├── src-tauri/
│   ├── src/
│   │   ├── commands.rs        # Comandos IPC expuestos a la capa de presentación
│   │   ├── engine.rs          # Motor de descarga acelerada por rangos HTTP
│   │   ├── manager.rs         # Administrador de tareas, persistencia y ciclo de vida
│   │   ├── media_extractor.rs # Subsistema de extracción con yt-dlp y FFmpeg
│   │   ├── models.rs          # Estructuras de datos serializables
│   │   ├── probe.rs           # Inspección preliminar de URLs remotas
│   │   └── lib.rs             # Configuración de plugins y arranque de Tauri
│   ├── Cargo.toml             # Dependencias del ecosistema Rust
│   └── tauri.conf.json        # Configuración de empaquetado y ventanas
└── package.json               # Dependencias del entorno Node.js
```

---

## Requisitos de Construcción

Para compilar BundleRock desde el código fuente se requiere:

1. **Node.js:** Versión 18.0 o superior con `npm`.
2. **Rust Toolchain:** Versión estable (instalable mediante `rustup`).
3. **Microsoft C++ Build Tools:** Requerido para la vinculación nativa en Windows (incluido en Visual Studio Build Tools).

---

## Instrucciones de Compilación

### 1. Clonar el repositorio
```powershell
git clone https://github.com/Franz2308/bundlerock.git
cd bundlerock
```

### 2. Instalar dependencias del cliente web
```powershell
npm install
```

### 3. Verificación de tipos y análisis de código
```powershell
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 4. Ejecución en modo de desarrollo
```powershell
npm run tauri dev
```

### 5. Compilación de distribuibles para producción
```powershell
npm run tauri build
```

Los binarios finales se generarán en las siguientes ubicaciones:
* **Ejecutable Portable:** `src-tauri/target/release/bundlerock.exe`
* **Instalador NSIS:** `src-tauri/target/release/bundle/nsis/BundleRock_0.1.0_x64-setup.exe`

---

## Distribución y Binarios Precompilados

Los paquetes de instalación y versiones ejecutables directas están disponibles en la sección de [Releases de este repositorio](https://github.com/Franz2308/bundlerock/releases).
