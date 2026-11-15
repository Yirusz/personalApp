# ADR-0008: Stack del frontend

Estado: aceptado
Fecha: 2026-11-14

## Contexto
La guía (§1, §5) fija por defecto Preact + Vite, TypeScript, IndexedDB y Vitest. Hay que elegir versiones concretas vigentes en noviembre de 2026 y decidir qué dependencias evitar.

## Opciones consideradas
- **TypeScript 7 (compilador nativo en Go)**: más rápido, pero `typescript-eslint` 8.x solo admite TypeScript < 6.1 → sin lint con tipos.
- **TypeScript 6.0** (última línea en JavaScript): compatible con todo el ecosistema.
- **`@preact/preset-vite`**: arrastra Babel solo para JSX y HMR.
- **JSX con Oxc integrado en Vite 8** (`oxc.jsx.importSource = 'preact'`): sin Babel.
- **Workbox** (~10 KB + plugin) vs **Service Worker escrito a mano** (~45 líneas) + plugin de build propio (~30 líneas).
- **`idb`** (ISC, ~1 KB) vs envoltura propia sobre IndexedDB: la envoltura propia ya era necesaria para aislar módulos y la bandeja de eventos.

## Decisión
| Pieza | Versión | Licencia | Peso / costo |
|---|---|---|---|
| Preact | 11.2.0 | MIT | ~4–5 KB comprimido (en tiempo de ejecución) |
| Vite (Rolldown + Oxc) | 8.3.8 | MIT | Solo desarrollo |
| TypeScript | 6.0.3 | Apache-2.0 | Solo desarrollo |
| Vitest | 5.1.0 | MIT | Solo desarrollo |
| ESLint + typescript-eslint | 10.15 / 8.72 | MIT / BSD-2 | Solo desarrollo |
| fake-indexeddb | 6.2.8 | Apache-2.0 | Solo pruebas |
| @types/node | 22 | MIT | Solo tipos de pruebas/config |

- Sin preset de Preact (sin Babel), sin Workbox, sin `idb`, sin librería de enrutamiento ni de estado: **una sola dependencia de ejecución (Preact)**.
- Override de `minimatch` ≥ 11.0.1 dentro de `typescript-eslint` para cerrar el aviso GHSA-g3hv-75wg-m249 (solo herramienta de desarrollo).
- Node 22 LTS (`.nvmrc`), igual en CI.

## Consecuencias
- JS inicial ≈ 23 KB comprimido (presupuesto: < 150 KB).
- Sin HMR con preservación de estado de Preact (se recarga la página en desarrollo); aceptable.
- Revisar en 2027 el paso a TypeScript 7 cuando `typescript-eslint` lo soporte.
