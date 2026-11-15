# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

## [0.3.0] — 2026-11-15 · Iteración 2: Calendario

### Agregado
- Módulo **Calendario** (ADR-0011): eventos con título, inicio–fin o todo el día (fechas sin hora ni zona), lugar, notas y color; eliminar con "Deshacer".
- Repeticiones diaria, semanal (días elegidos) y mensual, cada N, con fin por fecha o número de veces; editar o borrar solo una ocurrencia (con "Deshacer") o toda la serie. Las ocurrencias se calculan solo para lo que se ve.
- Vistas agenda (14 días), día, semana (7 columnas desde 720 px, un día a la vez en el teléfono) y mes (puntos de color en 360 px). Atajos ← → T N; el mes se recorre con flechas, Re Pág/Av Pág y Enter.
- Entregas de Universidad (y de cualquier módulo que publique `datos.agenda`) en el calendario, diferenciadas y de solo lectura. Si una fuente falla, se muestra el resto con un aviso.
- Recordatorios múltiples por evento: notificación con Ludus abierto (si hay permiso) y bandeja "Recordatorios" en Inicio al abrir. La UI explica qué garantiza cada plataforma.
- Importar .ics con vista previa y sin duplicar (por UID); exportar .ics con repeticiones, excepciones, alarmas y, opcionalmente, las entregas. Lector/generador propio sin dependencias (ADR-0012).
- Bloque de compromiso: marcar cumplido da 15 XP de Disciplina (tope 45/día, una vez por ocurrencia). Revisión semanal "Semana planificada" (30 XP, una vez por semana).
- Tarjeta de Inicio con lo de hoy, recordatorios pendientes y la revisión semanal.
- Núcleo: `nucleo/dominio/zona-horaria.ts`, tareas `alIniciar` de módulo, puerto `ctx.notificaciones` (vía Service Worker), `navegar(ruta, { reemplazar })` sin mover el foco.

### Cambiado
- `formatos.entradaLocal/desdeEntradaLocal` usan la nueva conversión de zona del núcleo.

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
