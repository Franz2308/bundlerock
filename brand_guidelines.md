# Brand & UI Design Guidelines (`brand_guidelines.md`)

## 1. Visual Theme & Aesthetics
- **Theme Style**: Sobrio, profesional, estilo utilitario Win32 retro-moderno con soporte completo para Dark Mode y Light Mode.
- **Tone**: Técnico, de alta densidad de información, sin elementos infantiles y **estrictamente sin emojis**.
- **Iconografía**: Lucide Icons vectoriales con trazo limpio (`stroke-width: 1.75` a `2`).

---

## 2. Color Palette & Tokens

### Dark Mode (Predeterminado)
- **Background Root**: `#0f172a` (Slate 900)
- **Header Corporativo**: `#1a365d` (Navy azul corporativo de BundleRock)
- **Surface / Card / Modal**: `#1e293b` (Slate 800)
- **Bordes**: `#334155` (Slate 700)
- **Texto Principal**: `#f8fafc` (Slate 50)
- **Texto Secundario / Muted**: `#94a3b8` (Slate 400)
- **Acentos / Acciones**: `#2563eb` (Blue 600) / `#38bdf8` (Sky 400)
- **Éxito**: `#10b981` (Emerald 500)
- **Peligro / Error**: `#ef4444` (Red 500)

### Light Mode
- **Background Root**: `#f8fafc` (Slate 50)
- **Header Corporativo**: `#1a365d` (Navy azul corporativo)
- **Surface / Card / Modal**: `#ffffff` (Blanco)
- **Bordes**: `#cbd5e1` (Slate 300)
- **Texto Principal**: `#0f172a` (Slate 900)
- **Texto Secundario / Muted**: `#64748b` (Slate 500)

---

## 3. Extension UI Guidelines (`browser-extension/`)
- La página de opciones (`options.html`) y popup (`popup.html`) de la extensión deben seguir la misma paleta Slate / Navy `#1a365d`.
- Tipografía del sistema: `Segoe UI`, `system-ui`, `-apple-system`, `sans-serif`.
- Botones rectangulares con bordes sutiles (`rounded-md`), estados `:hover` y `:active` nítidos.
