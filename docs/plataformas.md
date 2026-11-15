# Plataformas — Ludus

## Matriz de soporte

| Entorno | Navegador | Instalación como app | Notas |
|---|---|---|---|
| Windows 11 | Chrome / Edge | ✅ Sí | Referencia de escritorio. |
| Windows 11 | Zen (basado en Firefox) | ⚠️ No verificado | Funciona en pestaña. Sin acceso a carpetas (irrelevante en el MVP). Pide permiso al "proteger datos". |
| Linux | Chrome / Chromium | ✅ Sí | |
| Linux | Zen | ❌ (Firefox en Linux aún no instala PWA a nov. 2026) | Funciona en pestaña, también sin conexión. |
| Android | Chrome — Galaxy Tab S10 FE | ✅ Sí (WebAPK) | En horizontal usa el riel lateral (≥ 720 px). |
| Android | Chrome — Galaxy A56 | ✅ Sí (WebAPK) | Dispositivo de referencia para rendimiento. |

Requisitos mínimos: navegador con `light-dark()` de CSS (Chrome ≥ 123, Firefox ≥ 120), IndexedDB y módulos ES. Android 10+.

## Instalar la app

1. Abrir la URL publicada (GitHub Pages, ver README) en HTTPS.
2. **Chrome escritorio:** ícono de instalar en la barra de direcciones → "Instalar".
3. **Chrome Android:** menú ⋮ → "Agregar a la pantalla principal" → "Instalar".
4. **Zen:** usar en una pestaña (fijarla); funciona igual, sin ventana propia.
5. En Ajustes → "Pedir al navegador que no borre mis datos" y exportar un primer respaldo.

## Probar en Android durante el desarrollo

El Service Worker exige HTTPS o `localhost`; `http://192.168.x.x` **no** sirve.

**Opción A — reenvío de puertos por USB (recomendada):**
1. En el teléfono: Opciones de desarrollador → Depuración USB.
2. En el PC: `npm run dev` (puerto 5173) y abrir `chrome://inspect/#devices` en Chrome.
3. "Port forwarding…" → `5173` → `localhost:5173` → activar.
4. En el teléfono abrir `http://localhost:5173` (contexto seguro).
5. Para ver y controlar el teléfono desde el PC: `scrcpy` (Apache-2.0).

> Nota: en modo desarrollo el Service Worker está desactivado a propósito. Para probar la instalación y el modo sin conexión usar `npm run build && npm run preview -- --host` con reenvío del puerto 4173, o la versión publicada en Pages.

**Opción B — GitHub Pages:** cada push a `main` publica la app (workflow `pages.yml`).

## Checklist manual por iteración (Definition of Done)

| Verificar | Win Chrome | Win Zen | Linux Chrome | Linux Zen | Tab S10 FE | A56 |
|---|---|---|---|---|---|---|
| Criterios de aceptación de la iteración | | | | | | |
| Sin conexión (modo avión) tras la primera carga | | | | | | |
| Tema claro / oscuro | | | | | | |
| Botón atrás de Android regresa de pantalla | n/a | n/a | n/a | n/a | | |
| Teclado virtual no tapa los campos | n/a | n/a | n/a | n/a | | |
| Operable solo con teclado (Tab, Enter, Escape) | | | | | n/a | n/a |
| 360 / 768 / 1280 px sin desbordes | | | | | | |
| Exportar e importar respaldo | | | | | | |
