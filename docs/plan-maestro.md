# Plan maestro — Ludus

> Punto de entrada para cualquier sesión nueva. Leer esto, luego `docs/adr/` y el código. Actualizar este archivo al cerrar cada iteración.

**Estado (2026-11-14):** iteración 1 (Universidad, U1–U6) terminada. Versión `0.2.0`. Siguiente: iteración 2 — Calendario.

## 1. Decisiones tomadas (resumen)

| # | Decisión | ADR |
|---|---|---|
| 1 | **Sincronización:** solo local + exportar/importar JSON. Modelo listo para Syncthing más adelante (UUIDv7, registro de eventos). | 0002 |
| 2 | **Obsidian:** fuera del MVP. Las notas se modelarán como Markdown + frontmatter compatible. | 0003 |
| 3 | **Cliente:** PWA pura. Sin avisos con la app cerrada (aceptado). Tauri 2 solo si esa limitación duele en el uso real. | 0004 |
| 4 | **Gamificación:** XP solo positiva, talla S/M/L superlineal, topes diarios, rendimiento decreciente, racha semanal flexible con comodines, oro aparte para recompensas propias. Reglas en `reglas.v1.json`. | 0005 |
| 5 | **MVP:** Universidad + Calendario (agenda y semana) + Estudio (Pomodoro con app abierta) + RPG v1. | 0006 |
| 6 | **Nombre y estilo:** "Ludus", minimalista sobre design tokens; tema pixel art 8/16 bits = otra hoja de tokens, después. | 0007 |
| 7 | **Stack:** Preact 11, Vite 8 (Oxc, sin Babel), TypeScript 6, Vitest 5, ESLint 10. Única dependencia de ejecución: Preact. | 0008 |
| 8 | **Datos y eventos:** IndexedDB única con almacenes por módulo y migraciones por módulo; bandeja de eventos + cursor por suscripción (exactamente una vez). | 0009 |
| 9 | **Composición:** módulos descubiertos automáticamente; rutas con hash; prueba de arquitectura en CI. | 0010 |

Dispositivos del usuario: Windows y Linux (Zen, Chrome), Galaxy Tab S10 FE y Galaxy A56 (Chrome). Zona `America/Bogota`.

## 2. Qué existe ya (fase 1 + iteración 1)

- **Núcleo** (`web/src/nucleo`): contrato de módulo, registro con validación, `AlmacenIndexedDb` (migraciones por módulo, aislamiento, transacciones todo-o-nada), `BusDeEventos` (bandeja + cursores, pausa por fallo, reanudar), UUIDv7 monótono, `Reloj`, i18n es-CO + `Intl` en Bogotá, respaldo JSON atómico, diagnóstico local persistido.
- **Shell** (`web/src/ui`): barra inferior < 720 px / riel lateral ≥ 720 px, "Más" si hay > 5 entradas, tema sistema/claro/oscuro con `light-dark()`, Inicio con tarjetas de módulos, Ajustes (tema, persistencia, exportar/importar), Diagnóstico.
- **PWA:** manifest, íconos (incl. maskable), Service Worker propio (precaché, sin red, actualización a pedido), CSP estricta en producción.
- **Módulos:** `ejemplo` (recorre el contrato; se puede borrar) y `rpg` (libro de experiencia, perfil, nivel, reglas `xp`/`xpPorTalla`/`limiteDiarioXp`, tarjeta de Inicio y pantalla Progreso).
- **Universidad** (`web/src/modulos/universidad`, iteración 1): materias (crear, renombrar, archivar/restaurar con deshacer), entregables (registrar, editar, empezar, completar, reabrir, reprogramar, eliminar con deshacer), "Próximos vencimientos" (72 h), filtros persistentes, tarjeta en Inicio. 11 eventos `universidad.*` con `datos.agenda`. Migración v1.
- **RPG** (adelantado de R1): `unaVezPor`, `minMinutosDesdeCreacion`, `minAntelacionHoras`, `multiplicadorPuntual` (función pura `calcularXp`; migración v2). Faltan `tramosDiarios`, racha, logros y recompensas.
- **Compartido** (ver `docs/arquitectura.md` §4): `ElementoDeAgenda` + colores por token en el núcleo; `formatos.entradaLocal/desdeEntradaLocal/relativo`; barra "Deshacer" del shell (`ui/deshacer.tsx`); utilidades CSS de formularios y listas.
- **Calidad:** 112 pruebas (Vitest + fake-indexeddb), prueba de arquitectura, `npm run check`, CI Windows + Linux, despliegue a GitHub Pages. Recorrido de UI en Chrome a 360/768/1280 px, teclado, tema oscuro y sin conexión (iteración 1).

## 3. Backlog por iteraciones

Velocidad: iteración 1 = 15 puntos de Universidad + ~3 de R1 adelantados (reglas del RPG que U4 necesitaba) + piezas compartidas (deshacer, agenda, formatos). Se mantiene ~15–20 por iteración. Historias completas con criterios en `docs/story-map.md`.

| Iteración | Objetivo | Historias | Pts |
|---|---|---|---|
| ~~1~~ ✅ | ~~Universidad~~ | U1–U6 terminadas (0.2.0) | 15 |
| **2** | **Calendario** | C1 Agenda (3) · C3 Eventos (3) · C4 Proyección `datos.agenda` (3) · C2 Vista semana (5) · C5 Recordatorios al abrir (3) · C6 Revisión semanal (2) | 19 |
| 3 | Estudio | E1 Pomodoro (5) · E2 Configuración (2) · E3 Aviso con app visible (3) · E4 Estadísticas (3) · E5 Resistente a congelamiento (2) | 15 |
| 4 | RPG v1 completo | R1 Tramos diarios de Pomodoro + nombres legibles en el historial (2; el resto de R1 se hizo en la iteración 1) · R2 Racha + comodines (5) · R3 Logros (3) · R4 Recompensas y canje (3) · R5 Avisos de nivel/logro (2) | 15 |
| 5 | Endurecer y lanzar 1.0.0 | E2E con Playwright en 360/768/1280 · checklist de `plataformas.md` en los 6 entornos · Lighthouse en A56 · recordatorio de respaldo (> 7 días) · borrar módulo `ejemplo` · CHANGELOG 1.0.0 | — |
| 6 | Notas | N1 Nota Markdown · N2 Etiquetas · N3 Búsqueda · N4 Vínculos a materia/entregable | ~18 |
| 7 | Calendario+ | C7 Vista mes · C8 Recurrentes · C9 Exportar .ics | ~13 |
| 8 | Obsidian (b) | O1 Exportar/importar notas `.md` con frontmatter (ADR nuevo) | ~8 |
| 9 | Sincronización | S1 Syncthing con registro de operaciones por dispositivo (ADR nuevo, reemplaza 0002) | ~13 |
| — | Estilo pixel art | R7 Hoja de tokens `data-estilo="pixel"` + fuente OFL bajo demanda | ~5 |

### Iteración 2 en detalle (propuesta)
1. `web/src/modulos/calendario/`: `modulo.ts`, migración v1 (`eventos` con índice por inicio, `agenda` = proyección con índice por inicio, `revisiones` con clave = semana ISO).
2. **C4 primero** (desbloquea la agenda con datos reales): suscripción `calendario.agenda` a `'*'` con historial completo que hace *upsert* de `datos.agenda` por `<modulo>:<agenda.id>` y borra con `estado: 'eliminado'`. Calendario **no** importa Universidad: solo lee `ElementoDeAgenda` del núcleo.
3. Dominio puro con pruebas desde los Gherkin: `Intervalo` (fin > inicio, ≤ 14 días), `Recordatorio` (0–10 080 min), `SemanaIso`, agrupación por día local de Bogotá (escenario de medianoche de C1).
4. C1 agenda 14 días → C3 eventos (formulario con `formatos.entradaLocal`, deshacer al eliminar) → C2 semana (7 columnas ≥ 720 px; un día con flechas/deslizar < 720 px; ←/→ cambia semana) → C5 recordatorios al abrir (bandeja en Inicio; notificación solo con la app visible y permiso) → C6 "Semana planificada" (la regla del RPG ya existe y aplica "una vez por semana").
5. Decidir (ADR corto o nota en dominio.md): ¿los vencimientos de una materia **archivada** siguen en el calendario? Hoy sí (Universidad no republica la agenda al archivar). Opción simple: que `MateriaArchivada` no cambie nada en el calendario (es historia).

## 4. Definición de Ready / Done
- **Ready:** valor claro, criterios Gherkin (incluido sin conexión), dependencias conocidas, plataformas indicadas, ≤ 8 puntos.
- **Done:** `npm run check` verde en Windows y Linux (CI), revisado en 360/768/1280 px, operable con teclado, probado sin conexión, migración incluida si cambia el esquema, eventos declarados y documentados, CHANGELOG y este plan actualizados.

## 5. Riesgos y deuda conocidos
| Riesgo / deuda | Impacto | Mitigación |
|---|---|---|
| El navegador borra IndexedDB (sin persistencia concedida) | Pérdida de datos | Pedir persistencia, aviso en Ajustes, respaldo manual; recordatorio en iteración 5 |
| Sin avisos con la app cerrada (PWA) | Pomodoro/recordatorios perdidos | Asumido (ADR-0004); disparador para evaluar Tauri |
| Importar solo respaldos de la misma versión de esquema | Respaldos viejos inservibles tras migraciones | Antes de 1.0: migrar respaldos aplicando migraciones en una base temporal |
| `nucleo_eventos` crece sin límite | Espacio (KB/día) | Compactación cuando haga falta (medir con Diagnóstico) |
| Un dispositivo "principal" por vez (sin merge) | Sobrescribir datos al importar | Documentado; ADR de Syncthing en iteración 9 |
| CI en GitHub Actions (servicio propietario) | Dependencia externa | Workflows simples, portables a Forgejo Actions |
| Instalación de PWA en Zen no verificada | Sin ventana propia | Funciona en pestaña |
| Eliminar es diferido 10 s (deshacer): si la pestaña muere sin pasar por segundo plano, no se elimina | El entregable reaparece (fallo seguro) | Se confirma al ocultarse la app (`visibilitychange`/`pagehide`) |
| "Vencido" y los tiempos relativos no se refrescan solos con la pantalla abierta | Texto desactualizado hasta navegar o cambiar datos | Agregar un tic por minuto si molesta en el uso real |
| Guardar en la ficha del entregable = 2 transacciones (editar + reprogramar) | Si la 2.ª falla, la 1.ª queda guardada | Se valida todo antes; riesgo bajo. Un caso de uso "actualizar" si llega a importar |
| El color de una materia no se puede cambiar | Menos flexible | Requiere republicar la agenda de sus entregables; evaluar con Calendario |
| Universidad lee todos sus entregables en memoria | Lento con miles | Hay índices `por_materia` y `por_estado` para paginar si hace falta |
| El historial de Progreso muestra tipos técnicos (`universidad.EntregableCompletado`) | UX | Nombres legibles en R1 (iteración 4) |

## 6. Cómo continuar en una sesión nueva
Usar el "Prompt 2" de `claude/prompts-app.md` (proyecto en claude.ai) con: *"iteración 2 — Calendario (C1–C6)"*. Comandos: ver README. Guion de prueba manual por iteración en `docs/plataformas.md`.
