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

### Iteración 1 — Universidad (guion de prueba manual, ~10 min por entorno)
1. **Materias:** Universidad → Materias. Pulsar "Crear materia" vacío → error en el campo y foco en él. Crear "Cálculo II" (verde) y "Física I" (azul). Intentar "cálculo ii" → "Ya tienes una materia con ese nombre".
2. **Registrar:** "Registrar entregable" sin llenar nada → se marcan materia (si hay varias), título y fecha. Registrar "Taller 3" de Física I para mañana 23:59, Alta, M. Registrar uno con fecha de ayer → aviso amarillo "ya pasó", se guarda como vencido.
3. **Lista:** aparecen arriba en "Próximos vencimientos" (el vencido primero). Filtrar por Física I + Completados, ir a Inicio y volver: el filtro se conserva.
4. **Estado:** abrir "Taller 3" → Empezar → la talla queda deshabilitada. Completar → en Progreso aparece la XP (0 con nota "completado muy rápido" si fue antes de 10 min: es la regla anti-farmeo). Reabrir y completar otra vez → no suma XP ("ya se premió antes").
5. **Reprogramar / eliminar:** cambiar la fecha y guardar. "Eliminar entregable" → desaparece y aparece "Deshacer" 10 s; deshacer → vuelve. Repetir sin deshacer → se elimina.
6. **Archivar:** archivar Física I → Deshacer (o Ctrl+Z en escritorio) → vuelve. Archivarla de nuevo → ya no aparece en el selector de materia al registrar; en "Archivadas" se puede restaurar.
7. **Sin conexión:** modo avión, recargar y repetir 2 y 4: todo funciona igual, sin marcas de "pendiente".
8. **Android:** el botón atrás regresa de la ficha del entregable a la lista; el teclado virtual no tapa el campo de título; los botones se pueden tocar sin errores (objetivos ≥ 48 px).

