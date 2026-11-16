# ADR-0017: racha evaluada por semanas cerradas en la suscripción, y avisos del shell

Estado: aceptado (iteración 6; "sin gracia" elegido por el usuario)
Fecha: 2026-11-16
Precisa: ADR-0005 (gamificación v1), ADR-0009 (eventos), ADR-0016 (`ocurridoEn`).

## Contexto
La racha semanal depende de que una semana *termine*. La app no corre en segundo plano (Android la congela) y no queremos temporizadores ni procesos permanentes. Además, con `ocurridoEn` explícito (ADR-0016) un evento puede llegar después de que cerró su semana, y el resultado debe ser el mismo se evalúe cuando se evalúe.

Para R5 (avisos de nivel y logro) ningún módulo debe dibujar fuera de sus pantallas.

## Opciones consideradas (racha)
1. **Evaluar dentro de la suscripción `rpg.experiencia`, por hora de publicación** (elegida): antes de procesar cada evento se evalúan, en orden, las semanas cuyo cierre (lunes 00:00 Bogotá) es anterior a la publicación del evento (marca del UUIDv7). Al abrir la app, si hay semanas pendientes, el RPG publica `rpg.SemanasCerradas` para que el bus las evalúe en el mismo orden.
2. Evaluar al abrir la app, fuera del bus: rápido de hacer, pero el resultado dependería de cuándo se abrió la app respecto a eventos atrasados (no determinista).
3. Período de gracia (p. ej. hasta el lunes 06:00): más indulgente con Android congelado, pero complica el modelo; el usuario eligió **sin gracia**.

## Decisión
- Un evento cuenta como actividad de su semana solo si se publicó antes del cierre de esa semana.
- El multiplicador usa la racha que regía en la semana del evento (`semanas[lunes anterior].despues`).
- Contadores por día, semanas evaluadas, contadores de logros y logros se escriben en la misma transacción que el asiento (exactamente una vez, ADR-0009). Al actualizar, los contadores se rellenan una vez desde el libro.
- Núcleo: puerto `ctx.avisos.mostrar({ titulo, detalle?, icono? })` implementado por el shell (un aviso a la vez, 5 s o Escape, `aria-live`, sin animación con `prefers-reduced-motion`). El RPG guarda avisos pendientes en su almacén y, en `alIniciar`, los agrupa en uno.
- `Traductor.existe(clave)` para que el historial muestre la etiqueta que cada módulo declara (`<modulo>.evento.<Nombre>`) sin que el RPG conozca módulos; si falta, se muestra el tipo técnico.

## Consecuencias
- Determinista y recalculable desde el registro de eventos; sin temporizadores.
- Un Pomodoro del domingo detectado el lunes da su XP en el domingo pero no salva la racha (documentado en el story map y en Estudio).
- Si nadie abre la app ni publica eventos, la semana se evalúa al volver: el bono de 50 XP queda fechado el domingo 23:59:59,999 aunque se registre después.
- Los contadores con filtro por datos (p. ej. trabajos a tiempo) solo cuentan desde la 0.7.0: el libro no guarda los datos de los eventos. Recalcular (R8) lo resolverá.
