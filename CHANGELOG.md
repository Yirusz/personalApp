# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

## [0.2.0] — 2026-11-14 · Iteración 1: Universidad

### Agregado
- Módulo **Universidad** (U1–U6): materias con color y créditos; entregables (tarea, trabajo, parcial, otro) con fecha y hora de entrega, prioridad y talla S/M/L; estados pendiente → en curso → completado, reabrir; reprogramar; eliminar con "Deshacer" de 10 s; archivar y restaurar materias con "Deshacer".
- Pantalla Universidad con "Próximos vencimientos" (72 h y vencidos) y filtros por materia y estado que se conservan; tarjeta "Próximas entregas" en Inicio.
- Eventos `universidad.*` con `datos.agenda` (listos para el Calendario) y los datos que necesita el RPG (`antelacionHoras`, `aTiempo`, `minutosDesdeCreacion`, `talla`).
- RPG: el motor aplica `unaVezPor`, `minMinutosDesdeCreacion`, `minAntelacionHoras` y `multiplicadorPuntual` de `reglas.v1.json` (reabrir y volver a completar no da doble premio; completar en menos de 10 min no da XP; puntualidad ×1,2). Notas visibles en el historial de Progreso. Migración v2 del RPG (índice `por_clave_unica`).
- Núcleo y shell: `ElementoDeAgenda` y colores categóricos por token; `formatos.entradaLocal` / `desdeEntradaLocal` / `relativo`; barra "Deshacer" genérica (también Ctrl+Z); utilidades CSS para formularios y listas.

### Cambiado
- `.acciones` centra sus elementos verticalmente.

## [0.1.0] — 2026-11-14 · Fase 1: fundación

### Agregado
- Fase 1: visión, story map, modelo de dominio, arquitectura (C4), reglas de gamificación v1, ADRs 0001–0010, escenarios de calidad y plan maestro.
- Fundación de la PWA `web/`: shell con navegación adaptativa, tema claro/oscuro/sistema, textos en es-CO, manifest y Service Worker escrito a mano.
- Núcleo: registro de módulos con descubrimiento automático, bus de eventos con bandeja de salida (outbox) persistente y cursores por suscriptor, IndexedDB con migraciones por módulo, UUIDv7, `Reloj` inyectable, exportar/importar JSON y pantalla de diagnóstico.
- Módulo `ejemplo` que recorre el contrato de punta a punta y núcleo del módulo `rpg` que registra la experiencia según `reglas.v1.json`.
- `npm run check` (lint, tipos y pruebas) y CI con matriz Windows + Linux.
