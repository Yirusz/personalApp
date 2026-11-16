# Plan maestro — Ludus

> Punto de entrada para cualquier sesión nueva. Leer esto, luego `docs/adr/` y el código. Actualizar este archivo al cerrar cada iteración.

**Estado (2026-11-15):** iteración 4 (revisión del Calendario: vistas, fichas, color libre y vínculos, ADR-0015) terminada. Versión `0.5.0`. Siguiente: iteración 5 — Estudio.

## 1. Decisiones tomadas (resumen)

| # | Decisión | ADR |
|---|---|---|
| 1 | **Sincronización:** solo local + exportar/importar JSON. Modelo listo para Syncthing más adelante (UUIDv7, registro de eventos). | 0002 |
| 2 | **Obsidian:** fuera del MVP. Las notas se modelarán como Markdown + frontmatter compatible. | 0003 |
| 3 | **Cliente:** PWA pura. Sin avisos con la app cerrada (aceptado). Tauri 2 solo si esa limitación duele en el uso real. | 0004 |
| 4 | **Gamificación:** XP solo positiva, XP por tipo de trabajo (+ bono por peso alto), topes diarios, rendimiento decreciente, racha semanal flexible con comodines, oro aparte para recompensas propias. Reglas en `reglas.v1.json`. | 0005, 0014 |
| 5 | **MVP:** Universidad + Calendario completo (agenda/día/semana/mes, recurrencia, recordatorios, .ics) + Estudio (Pomodoro con app abierta) + RPG v1. | 0006, 0011 |
| 6 | **Nombre y estilo:** "Ludus", minimalista sobre design tokens; tema pixel art 8/16 bits = otra hoja de tokens, después. | 0007 |
| 7 | **Stack:** Preact 11, Vite 8 (Oxc, sin Babel), TypeScript 6, Vitest 5, ESLint 10. Única dependencia de ejecución: Preact. | 0008 |
| 8 | **Datos y eventos:** IndexedDB única con almacenes por módulo y migraciones por módulo; bandeja de eventos + cursor por suscripción (exactamente una vez). | 0009 |
| 9 | **Composición:** módulos descubiertos automáticamente; rutas con hash; prueba de arquitectura en CI. | 0010 |
| 10 | **Recurrencia e .ics:** código propio (subconjunto de RRULE; lector/generador .ics de carga diferida), sin dependencias. | 0012 |
| 11 | **Integración entre módulos por consulta:** `proveedores` en el contrato → `ctx.integraciones` (fuentes de calendario, referencias y fichas), tolerante a fallos. Eventos solo para reaccionar (RPG). | 0013, 0015 |
| 12 | **Fichas, color libre y vínculos:** plantillas para poner/quitar rápido en el calendario (Universidad aporta una clase semanal por materia); color `#rrggbb` con variantes legibles en claro/oscuro; eventos vinculados a entidades de otros módulos. | 0015 |

Dispositivos del usuario: Windows y Linux (Zen, Chrome), Galaxy Tab S10 FE y Galaxy A56 (Chrome). Zona `America/Bogota`.

## 2. Qué existe ya (fase 1 + iteraciones 1 a 4)

- **Núcleo** (`web/src/nucleo`): contrato de módulo, registro con validación, `AlmacenIndexedDb` (migraciones por módulo, aislamiento, transacciones todo-o-nada), `BusDeEventos` (bandeja + cursores, pausa por fallo, reanudar), UUIDv7 monótono, `Reloj`, i18n es-CO + `Intl` en Bogotá, respaldo JSON atómico, diagnóstico local persistido.
- **Shell** (`web/src/ui`): barra inferior < 720 px / riel lateral ≥ 720 px, "Más" si hay > 5 entradas, tema sistema/claro/oscuro con `light-dark()`, Inicio con tarjetas de módulos, Ajustes (tema, persistencia, exportar/importar), Diagnóstico.
- **PWA:** manifest, íconos (incl. maskable), Service Worker propio (precaché, sin red, actualización a pedido), CSP estricta en producción.
- **Módulos:** `ejemplo` (recorre el contrato; se puede borrar) y `rpg` (libro de experiencia, perfil, nivel, reglas `xp`/`xpPorTalla`/`limiteDiarioXp`, tarjeta de Inicio y pantalla Progreso).
- **Universidad v2** (`web/src/modulos/universidad`, iteraciones 1 y 3): materias con profesor, periodo, color y créditos editables (nombre único por periodo; archivar con deshacer); **trabajos** (tarea, taller, quiz, parcial, proyecto, exposición) con fecha y hora, prioridad, peso % opcional, descripción y **subtareas**; estados pendiente → en progreso → entregado → calificado o cancelado, reabrir deliberado; fecha real de entrega y "a tiempo"; nota 0,0–5,0. "Próximas entregas" (vencido / hoy / próximos 7 días / más adelante) con filtros persistentes. 13 eventos `Trabajo*`/`Materia*` (subtareas sin eventos). **Proveedores**: fuente de calendario `universidad.entregas` y referencias `universidad.materia`/`universidad.trabajo`. Migración v2 desde los datos de la iteración 1.
- **RPG** (adelantado de R1): `unaVezPor`, `minMinutosDesdeCreacion`, `minAntelacionHoras`, `multiplicadorPuntual` (función pura `calcularXp`; migración v2). Iteración 3: `xpPorValor` y `bonoPorUmbral` genéricos (ADR-0014). Faltan `tramosDiarios`, racha, logros y recompensas.
- **Calendario** (`web/src/modulos/calendario`, iteración 2): eventos propios (todo el día como fecha), series con excepciones por ocurrencia, vistas agenda/día/semana/mes (mes accesible con teclado), elementos de otros módulos de solo lectura (fuentes registradas consultadas por rango desde la iteración 3, y proyección `calendario.agenda` para módulos que solo publican eventos; tolerante a datos malos y fuentes que fallan), recordatorios (tarea `alIniciar` + bandeja en Inicio), .ics propio (ADR-0012), bloque de compromiso (XP) y revisión semanal (XP). Iteración 4: cabecera compacta y "+" flotante, semana de 7 columnas en 360 px, crear tocando (media hora) o arrastrando, línea de ahora viva, **panel de fichas** (tocar/arrastrar para poner, tocar para quitar, con deshacer), fichas propias, "Usar una ficha" y "Vincular a" en el formulario, color libre. 10 eventos `calendario.*`. Migración v2.
- **Compartido** (ver `docs/arquitectura.md` §4): `ElementoDeAgenda` + colores por token en el núcleo; `formatos.entradaLocal/desdeEntradaLocal/relativo`; barra "Deshacer" del shell (`ui/deshacer.tsx`); utilidades CSS de formularios y listas. Iteración 2: `nucleo/dominio/zona-horaria.ts`, `alIniciar` en el contrato, puerto `ctx.notificaciones`, `navegar(ruta, { reemplazar })`. Iteración 3: `proveedores` + `ctx.integraciones` (ADR-0013). Iteración 4: `nucleo/dominio/{color,fichas}.ts`, `integraciones.fichas()`, `ui/color.ts` (ADR-0015).
- **Calidad:** 190 pruebas (Vitest + fake-indexeddb), prueba de arquitectura, `npm run check`, CI Windows + Linux, despliegue a GitHub Pages. Recorrido de UI en Chrome a 360/768/1280 px, teclado, tema oscuro y sin conexión en cada iteración. JS inicial 33,7 KB gzip.

## 3. Backlog por iteraciones

Velocidad: iteración 1 = 15 puntos (+ ~3 de R1 adelantados); iteración 2 = ~46 puntos en una sola entrega por decisión del usuario (ADR-0011); iteración 3 = ~21 puntos (U7–U12 + integración); iteración 4 = ~23 puntos (H1, H7a/b, H8a/b, H9). Para planear se mantiene ~15–20 por iteración; la 2 fue excepcional. Historias completas con criterios en `docs/story-map.md`.

| Iteración | Objetivo | Historias | Pts |
|---|---|---|---|
| ~~1~~ ✅ | ~~Universidad~~ | U1–U6 terminadas (0.2.0) | 15 |
| ~~2~~ ✅ | ~~Calendario completo~~ | CA1–CA12 + C6 (0.3.0; ver story-map) | ~46 |
| ~~3~~ ✅ | ~~Revisión de Universidad~~ | U7–U12 + proveedores (0.4.0; ver story-map) | ~21 |
| ~~4~~ ✅ | ~~Revisión del Calendario~~ | H1, H7a/b, H8a/b, H9 (0.5.0; ver story-map) | ~23 |
| **5** | **Estudio** | E1 Pomodoro (5) · E2 Configuración (2) · E3 Aviso con app visible (3) · E4 Estadísticas (3) · E5 Resistente a congelamiento (2) | 15 |
| 6 | RPG v1 completo | R1 Tramos diarios de Pomodoro + nombres legibles en el historial (2; el resto de R1 se hizo en las iteraciones 1 y 3) · R2 Racha + comodines (5) · R3 Logros (3) · R4 Recompensas y canje (3) · R5 Avisos de nivel/logro (2) | 15 |
| 7 | Endurecer y lanzar 1.0.0 | E2E con Playwright en 360/768/1280 · checklist de `plataformas.md` en los 6 entornos · Lighthouse en A56 · recordatorio de respaldo (> 7 días) · borrar módulo `ejemplo` · CHANGELOG 1.0.0 | — |
| 8 | Notas | N1 Nota Markdown · N2 Etiquetas · N3 Búsqueda · N4 Vínculos a materia/trabajo (con `buscarReferencias`, ya disponible) | ~18 |
| ~~—~~ | ~~Calendario+~~ | Absorbida por la iteración 2 (ADR-0011) | — |
| 9 | Obsidian (b) | O1 Exportar/importar notas `.md` con frontmatter (ADR nuevo) | ~8 |
| 10 | Sincronización | S1 Syncthing con registro de operaciones por dispositivo (ADR nuevo, reemplaza 0002) | ~13 |
| — | Estilo pixel art | R7 Hoja de tokens `data-estilo="pixel"` + fuente OFL bajo demanda | ~5 |

### Iteración 5 en detalle (propuesta)
1. `web/src/modulos/estudio/`: migración v1 (`sesiones` con índices por fecha y por materia, `configuracion`).
2. **E5 primero, en el dominio:** la sesión guarda `inicio` y `duración` y calcula lo restante con el `Reloj` (nunca cuenta "ticks"); si Android congela la app, al volver se cierra con la hora real. Pruebas con reloj falso.
3. E1 fases foco/descanso corto/largo, opcionalmente ligadas a una materia **o a un trabajo**. **No** importar Universidad: el selector usa `ctx.integraciones.buscarReferencias({ tipo: 'universidad.materia' })` (ADR-0013); la sesión guarda `{tipo, id}` y resuelve el nombre al mostrar (si Universidad no está o falla, "sin materia").
4. E3 aviso al terminar con la app visible: reutilizar `alIniciar` + `ctx.notificaciones` (ya existen) + `navigator.vibrate` detectado.
5. E2 configuración (25/5/15, cada 4) y E4 estadísticas simples por materia y semana.
6. Eventos `estudio.PomodoroCompletado {materiaId?, minutosFoco}` y `estudio.DescansoCompletado`: las reglas ya existen en `reglas.v1.json` (los tramos diarios quedan para R1).
7. Opcional: las sesiones de estudio en el calendario registrando una fuente `estudio.sesiones` (tipo `bloque`), y una **ficha** "Bloque de estudio" (ADR-0015) para reservar tiempo con un toque, sin que Estudio conozca al Calendario.

## 4. Definición de Ready / Done
- **Ready:** valor claro, criterios Gherkin (incluido sin conexión), dependencias conocidas, plataformas indicadas, ≤ 8 puntos.
- **Done:** `npm run check` verde en Windows y Linux (CI), revisado en 360/768/1280 px, operable con teclado, probado sin conexión, migración incluida si cambia el esquema, eventos declarados y documentados, CHANGELOG y este plan actualizados.

## 5. Riesgos y deuda conocidos
| Riesgo / deuda | Impacto | Mitigación |
|---|---|---|
| El navegador borra IndexedDB (sin persistencia concedida) | Pérdida de datos | Pedir persistencia, aviso en Ajustes, respaldo manual; recordatorio en iteración 7 |
| Sin avisos con la app cerrada (PWA) | Pomodoro/recordatorios perdidos | Asumido (ADR-0004); disparador para evaluar Tauri |
| Importar solo respaldos de la misma versión de esquema | Respaldos viejos inservibles tras migraciones | Antes de 1.0: migrar respaldos aplicando migraciones en una base temporal |
| `nucleo_eventos` crece sin límite | Espacio (KB/día) | Compactación cuando haga falta (medir con Diagnóstico) |
| Un dispositivo "principal" por vez (sin merge) | Sobrescribir datos al importar | Documentado; ADR de Syncthing en iteración 9 |
| CI en GitHub Actions (servicio propietario) | Dependencia externa | Workflows simples, portables a Forgejo Actions |
| Instalación de PWA en Zen no verificada | Sin ventana propia | Funciona en pestaña |
| Eliminar es diferido 10 s (deshacer): si la pestaña muere sin pasar por segundo plano, no se elimina | El entregable reaparece (fallo seguro) | Se confirma al ocultarse la app (`visibilitychange`/`pagehide`) |
| "Vencido" y los tiempos relativos no se refrescan solos con la pantalla abierta | Texto desactualizado hasta navegar o cambiar datos | Agregar un tic por minuto si molesta en el uso real |
| Guardar en la ficha del trabajo = 2 transacciones (editar + reprogramar) | Si la 2.ª falla, la 1.ª queda guardada | Se valida todo antes; riesgo bajo. Un caso de uso "actualizar" si llega a importar |
| Universidad lee todos sus trabajos en memoria para la lista | Lento con miles | Hay índices `por_materia`, `por_estado` y `por_vencimiento`; la fuente de calendario ya consulta por rango |
| El historial de Progreso muestra tipos técnicos (`universidad.TrabajoEntregado`) | UX | Nombres legibles en R1 (iteración 6) |
| Consultas a proveedores en cada render del rango (ADR-0013) | Una fuente lenta retrasa el calendario | Cada fuente es independiente (allSettled); cachear por rango si alguna llega a ser lenta |
| Referencias guardadas por otros módulos pueden apuntar a trabajos borrados | Vínculo roto en Estudio/Notas | El consumidor resuelve por `ids` y muestra "no disponible" si falta |
| Reabrir borra la nota y la fecha de entrega | Se pierde la nota anterior | Es deliberado (lo pidió la historia) y el aviso lo dice; queda en el registro de eventos |
| Fichas: quitar con la ficha activa borra toda la serie (con deshacer) | Si se quería quitar una sola semana | "Borrar solo esta" sigue en la ficha del evento; documentado en la ayuda del panel |
| Panel de fichas sin teclado en la cuadrícula (los huecos no son enfocables) | Accesibilidad | Alternativa completa por teclado: "Nuevo evento" → "Usar una ficha" |
| Color hex ajustado por mezcla en sRGB | Un hex muy saturado cambia un poco de tono en tema oscuro | Suficiente para marcas; OKLCH si molesta |
| En 360 px con el panel de fichas abierto la cuadrícula queda más abajo | Hay que desplazar | El panel se cierra con "Fichas" y recuerda el estado |
| Datos de la iteración 1: tipo `trabajo` → taller, `otro` → tarea; periodo deducido de la fecha de creación | Clasificación aproximada | Editable en la ficha (el tipo solo mientras no esté entregado) |
| Recordatorios solo con Ludus abierto; en Android, solo en primer plano | Avisos perdidos | La UI lo dice; bandeja al abrir; exportar .ics al calendario del teléfono para alarmas reales (ADR-0004 sin cambios) |
| .ics de fuentes raras (YEARLY, BYSETPOS, zonas no IANA) | Se importa solo la primera ocurrencia o con hora de Bogotá | Avisos en la vista previa; disparador de ADR-0012 para cargar ical.js solo al importar |
| El calendario lee todos los eventos y los expande en memoria | Lento con miles de eventos | Personal: cientos. Si crece, índice por rango de fechas y expandir solo series candidatas |
| Los recordatorios de todo el día cuentan desde las 00:00 | "1 día antes" suena a medianoche | Documentado en el formulario; evaluar "a las 8:00" si molesta |
| Editar la serie descarta excepciones que dejan de ser ocurrencias | Se pierde una edición puntual al cambiar los días | Documentado en el aviso del formulario |
| La zona del usuario está fija en `America/Bogota` (`zonaDelUsuario`) | Viajes o mudanza | Un solo punto para cambiarla; preferencia de zona si llega a hacer falta |
| Desmarcar un bloque cumplido no descuenta XP | XP "regalada" si se marcó por error | Volver a marcar no suma (unaVezPor); aceptable para uso personal |

## 6. Cómo continuar en una sesión nueva
Usar el "Prompt 2" de `claude/prompts-app.md` (proyecto en claude.ai) con: *"iteración 5 — Estudio (E1–E5)"*. Comandos: ver README. Guion de prueba manual por iteración en `docs/plataformas.md`.
