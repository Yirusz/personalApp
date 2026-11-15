# ADR-0011: El Calendario completo entra al MVP

Estado: aceptado (modifica el alcance de ADR-0006)
Fecha: 2026-11-15

## Contexto
ADR-0006 dejó fuera del MVP la vista de mes y los eventos recurrentes ("Calendario+", iteración 7). Al empezar la iteración 2, el usuario pidió además: vista de día, eventos de todo el día con lugar, notas y color, recordatorios configurables por evento, edición o borrado de una sola ocurrencia, importar y exportar .ics, un bloque de compromiso con XP y la revisión semanal. Motivo: registrar el horario de clases una sola vez y traer el calendario de la universidad sin quedar atrapado en la app.

## Opciones consideradas
| Opción | Pros | Contras |
|---|---|---|
| **A. Todo en una iteración** (elegida por el usuario) | Un calendario completo y usable de una vez; el modelo de datos nace con recurrencia (sin migraciones después) | ~46 puntos (dos o tres iteraciones de trabajo); Estudio y RPG se retrasan |
| B. Tres sub-iteraciones (base → recurrencia y recordatorios → mes e .ics) | Versiones usables antes | Más ciclos de revisión |
| C. Solo la base y mantener ADR-0006 | Respeta el plan | El horario semanal habría que cargarlo evento por evento hasta la iteración 7 |

## Decisión
**A.** El MVP incluye: eventos propios (todo el día como fecha civil), recurrencia (subconjunto de RRULE con excepciones por ocurrencia), vistas agenda/día/semana/mes, elementos de otros módulos de solo lectura, recordatorios múltiples, .ics (ADR-0012), bloque de compromiso y revisión semanal. La iteración 7 desaparece del plan. Siguen fuera del MVP: notas, Obsidian, sincronización y avisos con la app cerrada (ADR-0004 no cambia).

Las entregas de una materia archivada **siguen** en el calendario: son historia (decisión del usuario).

## Consecuencias
- La iteración 2 entrega 0.3.0 con ~46 puntos; Estudio pasa a ser la iteración 3 sin cambios.
- Más superficie que probar en los 6 entornos (guion en `docs/plataformas.md`).
- El bloque de compromiso agrega una regla al RPG (`calendario.EventoMarcadoCumplido`: 15 XP, tope 45/día, una vez por ocurrencia).
