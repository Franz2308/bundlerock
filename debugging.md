# Autonomous Debugging & Self-Healing Protocol (`debugging.md`)

## 1. Principles
- **No adivinar**: Inspeccionar el código fuente y las salidas de terminal antes de realizar modificaciones.
- **Edición quirúrgica**: Modificar únicamente las funciones y módulos necesarios sin alterar código funcional adyacente.
- **Verificación inmediata**: Ejecutar la verificación de compilación (`cargo check` / `npm run build`) tras cada cambio estructural.

---

## 2. Comandos de Diagnóstico y Compilación

### Backend Rust (Tauri 2)
```powershell
cd src-tauri
cargo check
```

### Frontend React / TypeScript
```powershell
npm run build
```

### Extensión de Navegador
- En Chromium (Chrome, Edge, Brave): Abrir `chrome://extensions`, inspeccionar la consola del *Service Worker* (`background.js`) para capturar errores de `fetch` o de registro de menú contextual.

---

## 3. Protocolo de Auto-Recuperación
1. **Detección**: Si `cargo check` o `npm run build` fallan con un código distinto de cero.
2. **Localización**: Identificar la línea exacta y el tipo de error (tipos, propiedades faltantes o mutabilidad).
3. **Parcheo**: Aplicar corrección específica con herramientas de reemplazo de contenido.
4. **Re-comprobación**: Re-ejecutar el comando de verificación correspondiente para certificar cero advertencias/errores críticos.
