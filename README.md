# BundleRock

Accelerated download manager and multimedia extractor for Windows, developed with Tauri 2, Rust, and React.

---

## Overview

BundleRock is a high-performance desktop application designed for file transfer management and acceleration in Windows environments. Inspired by the technical architecture of traditional download managers such as Internet Download Manager (IDM), it combines a multithreaded dynamic segmentation engine implemented in Rust with a multimedia extractor subsystem based on `yt-dlp` and `FFmpeg`.

Its user interface prioritizes clarity, information density, and a classic Win32 aesthetic, offering comprehensive control over network connections, formats, interface language, visual themes, and download organization.

---

## Key Features

### Accelerated Download Engine
* **Concurrent Dynamic Segmentation:** Automatic file partitioning across multiple parallel connections (configurable to 1, 4, 8, 16, or 32 threads) using HTTP `Range` requests, maximizing available bandwidth utilization.
* **Preliminary Probe:** Remote inspection of HTTP headers (`Accept-Ranges`, `Content-Length`, `Content-Disposition`, `ETag`) prior to transfer to evaluate acceleration feasibility and exact resource size.
* **Efficient Disk I/O:** Asynchronous disk writing handled via Tokio, preventing UI latency and minimizing file reassembly overhead.
* **Real-Time Progress Telemetry:** Smooth streaming of transfer speed, percentage, and estimated time remaining (ETA) without buffer stalls on Windows.

### Multimedia Extraction and Galleries
* **Multi-Platform Support:** Decoupled stream downloading (video and audio) from YouTube, Twitter/X, Facebook, and Reddit.
* **Image Gallery Extraction:** Detection of multi-image posts (Twitter/X, Reddit) with an interactive checklist selector and organization options (create dedicated subfolder or save loose files).
* **Automatic Twitter GIF Conversion:** Loop stream detection with automatic remuxing to optimized `.gif` format using palette generation via FFmpeg.
* **Multi-Format Selection:** Concurrent selection of multiple resolutions or format variants for a single source, creating grouped independent tasks.
* **Stream Fallback Mechanism:** Graceful degradation to direct pre-muxed streams if external multiplexing binaries are unavailable, ensuring downloaded files always contain valid synchronized audio and video.

### Internationalization and Accessibility
* **Bilingual UI Support:** Native support for English and Spanish with complete UI string localization across all components, modals, and telemetry views.
* **Default English Startup:** Starts in English by default with zero configuration required.
* **Instant Language Toggle:** Dedicated Language tab in Settings permitting real-time toggling between English and Spanish with persistent storage in local configuration.

### User Interface and Customization
* **Central Settings Panel:** Configuration modal accessible from the toolbar or via `Ctrl+,` to manage visual themes, language, default thread counts, and telemetry display.
* **Integrated Dark Mode:** High-contrast night color palette with deep slate tones (`#0c1017`, `#141b27`, `#1a2332`), preserving retro styling while reducing eye fatigue.
* **Technical Information Level (Stats for Nerds):** Option to toggle advanced technical telemetry (active threads, per-connection byte ranges, segment inspection tables) or maintain a clean minimalist view.
* **Hierarchical Tree Structure:** Tree view grouping multi-format and multi-stream variants under expandable parent tasks.
* **Dual View Modes:** Seamless toggle between detailed table view (complete columns for file size, progress, speed, and status) and responsive compact card grid.
* **Configurable Multi-Download Confirmation:** Advisory dialog for simultaneous multi-variant downloads with preference persistence to suppress future warnings.
* **Integrated Title Bar:** Custom Win32 window header with native drag support and custom minimize, maximize, restore, and close actions.
* **Automatic Clipboard Integration:** Native clipboard inspection to automatically pre-fill download links upon opening the new download modal.

### Task Management and Persistence
* **State Persistence:** Automatic serialization of all download metadata to local storage (`tasks.json` in `AppData`), preserving history and resumed tasks across restarts.
* **Non-Destructive Deletion Policy:** Removing task entries from the list does not delete physical files from disk unless explicitly requested.
* **Automatic Dependency Provisioning:** Detection and silent background retrieval of required binaries (`yt-dlp` and `FFmpeg`) into `%APPDATA%\BundleRock\bin`.

---

## Tech Stack

* **Native Backend:**
  * Rust (2021 edition)
  * Tauri v2
  * Tokio (Asynchronous runtime)
  * Reqwest (HTTP client with streaming support)
  * Zip (In-memory archive extraction)
  * Tauri Plugin Clipboard Manager (Native clipboard access)

* **Frontend Presentation Layer:**
  * React 19
  * TypeScript
  * Vite
  * Tailwind CSS v4
  * Lucide React (Vector icons)

---

## Repository Structure

```text
bundlerock/
├── src/
│   ├── components/            # UI Components (TitleBar, Toolbar, SettingsModal, NewDownloadModal, Views)
│   ├── i18n/                  # Internationalization context, hooks, and English/Spanish dictionaries
│   ├── services/              # IPC client communicating with Tauri backend
│   ├── types/                 # TypeScript type definitions and data models (downloads, settings)
│   ├── utils/                 # Formatters for bytes, transfer speeds, and category classification
│   └── App.tsx                # Root state orchestrator, theme, language provider, and event routing
├── src-tauri/
│   ├── src/
│   │   ├── commands.rs        # IPC commands exposed to the frontend layer
│   │   ├── engine.rs          # Accelerated multithreaded HTTP range download engine
│   │   ├── manager.rs         # Task manager, lifecycle, and disk persistence
│   │   ├── media_extractor.rs # Extraction subsystem leveraging yt-dlp and FFmpeg
│   │   ├── models.rs          # Serializable Rust data structures
│   │   ├── probe.rs           # Preliminary remote URL inspection and header analysis
│   │   └── lib.rs             # Tauri plugin initialization and application bootstrap
│   ├── Cargo.toml             # Rust crate dependencies and workspace configuration
│   └── tauri.conf.json        # Tauri packaging, capabilities, and window definitions
└── package.json               # Node.js dependencies and build scripts
```

---

## Build Requirements

Building BundleRock from source requires:

1. **Node.js:** Version 18.0 or higher with `npm`.
2. **Rust Toolchain:** Stable release (installable via `rustup`).
3. **Microsoft C++ Build Tools:** Required for native compilation on Windows (included with Visual Studio Build Tools).

---

## Compilation Instructions

### 1. Clone the repository
```powershell
git clone https://github.com/Franz2308/bundlerock.git
cd bundlerock
```

### 2. Install web dependencies
```powershell
npm install
```

### 3. Type checking and validation
```powershell
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 4. Run in development mode
```powershell
npm run tauri dev
```

### 5. Compile production distributables
```powershell
npm run tauri build
```

Final executables and installers will be generated at:
* **Portable Executable:** `src-tauri/target/release/bundlerock.exe`
* **NSIS Installer:** `src-tauri/target/release/bundle/nsis/BundleRock_0.2.2_x64-setup.exe`

---

## Distribution and Pre-compiled Binaries

Installers and standalone binaries are available on the [Releases page](https://github.com/Franz2308/bundlerock/releases).
