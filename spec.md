# Technical Specification (`spec.md`) - Browser Integration

## 1. Project Overview & Objective
- **Problem Statement**: Iniciar descargas en BundleRock requiere actualmente copiar manualmente enlaces desde el navegador y pegarlos en la aplicación. Se requiere un flujo sin fricción, similar al estándar establecido por Internet Download Manager (IDM).
- **Target Audience**: Usuarios de escritorio en Windows que navegan habitualmente en Chrome, Edge, Brave o navegadores basados en Chromium.
- **Core Value Proposition**: Captura instantánea de enlaces mediante un clic derecho en el navegador ("Descargar con BundleRock"), manteniendo las páginas web limpias (sin widgets flotantes invasivos) y permitiendo que BundleRock resida silenciosamente en la bandeja del sistema (*System Tray*).

---

## 2. Minimum Viable Product (MVP) Scope

### Enfoque de Alcance Aprobado:
- [x] **Bandeja del Sistema (System Tray)**:
  - Al presionar la "X" en la barra de título, la ventana se oculta a la bandeja del sistema (`window.hide()`).
  - Icono de BundleRock en el área de notificaciones de Windows con menú contextual (*Mostrar*, *Pausar todas*, *Ajustes*, *Salir de BundleRock*).
  - Doble clic en el icono del reloj restaura la ventana a primer plano.
- [x] **Servidor HTTP Local en Rust (`axum`)**:
  - Escucha en `127.0.0.1:18200` en segundo plano desacoplado en Tokio.
  - Soporte de CORS estricto para orígenes de extensiones (`chrome-extension://*`, `moz-extension://*`).
  - Endpoint `POST /api/download` que recibe la URL, restaura la ventana si está minimizada/oculta y emite el evento `external-download-request`.
  - Endpoint `GET /api/status` para comprobación de conexión y salud del servidor.
- [x] **Extensión de Navegador (Manifest V3)**:
  - Menú contextual nativo de clic derecho: *"Descargar con BundleRock"*.
  - Compatible con enlaces directos (`linkUrl`), elementos multimedia (`srcUrl`) y páginas activas (`pageUrl`).
  - En YouTube: soporte mediante doble clic derecho para invocar el menú nativo del navegador.
  - Página de configuración (`options.html`) para ajustar puerto y probar conexión con BundleRock.
- [x] **Frontend React (`App.tsx` y `NewDownloadModal.tsx`)**:
  - Escucha del evento `external-download-request`.
  - Apertura automática del modal de nueva descarga con la URL pre-cargada y sondeo (`probe`) activado de inmediato.

### Fuera de Alcance (Out of Scope):
- Botones o widgets flotantes superpuestos en reproductores de video (descartado por solicitud del usuario para mantener la web limpia).
- Interceptación automática e indiscriminada de descargas del navegador sin acción del usuario.

---

## 3. Data Models & Contracts

### Payload de la API Local
```typescript
interface ExternalDownloadPayload {
  url: string;
  page_url?: string | null;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
```

### Evento Tauri IPC
```typescript
// Nombre del evento
"external-download-request"

// Payload emitido hacia React
interface ExternalDownloadEvent {
  url: string;
}
```

---

## 4. API Endpoints del Servidor Local (`127.0.0.1:18200`)

| Endpoint | Método | Descripción | CORS Permitido |
|---|---|---|---|
| `/api/status` | GET | Comprueba que BundleRock está activo y retorna versión | Extensiones (`chrome-extension://*`) |
| `/api/download` | POST | Recibe la URL, enfoca la ventana y abre el diálogo | Extensiones (`chrome-extension://*`) |

---

## 5. Reglas de Negocio Clave
1. **Prioridad de foco**: Al recibir una petición POST válida, la ventana de BundleRock debe des-minimizarse, mostrarse (`show()`) y tomar foco en Windows (`set_focus()`).
2. **Ciclo de vida en segundo plano**: La aplicación solo debe cerrarse por completo cuando el usuario pulse explícitamente "Salir de BundleRock" desde el menú de la bandeja del sistema o un comando directo de salida.
3. **No-intrusión**: La extensión no modificará el DOM de las páginas web ni inyectará estilos visuales en el contenido.
