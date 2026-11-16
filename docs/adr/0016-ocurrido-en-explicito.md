# ADR-0016: `ocurridoEn` explícito al publicar un evento

Estado: aceptado (elegido por el usuario en la iteración 5)
Fecha: 2026-11-15
Precisa: ADR-0009 (significado de `ocurridoEn`).

## Contexto
Hasta ahora `ocurridoEn` era siempre la hora de publicación. Un Pomodoro que termina a las 23:50 mientras Android congela la app solo se detecta al volver (p. ej. a las 00:10). Publicado con la hora de detección, caería en el día siguiente: estadísticas, tope diario de XP, tramos y racha contarían mal.

## Opciones consideradas
1. **`tx.publicar(tipo, datos, { ocurridoEn })` en el núcleo** (elegida): el evento dice cuándo pasó de verdad; todos los consumidores (RPG, racha, futuros) lo usan sin saber nada del Pomodoro.
2. `finalizadaEn` en los datos del evento: cada consumidor tendría que saber qué campo usar por tipo de evento (el RPG necesitaría configuración extra por regla).

## Decisión
- `ocurridoEn` = **cuándo pasó el hecho**. Por defecto, la hora de publicación; un módulo puede indicar uno anterior.
- Se valida en el almacén: instante ISO válido y **nunca en el futuro** (según el `Reloj`). Se normaliza a UTC.
- El **orden** de entrega sigue siendo el de publicación (ids UUIDv7 y cursores, ADR-0009); `ocurridoEn` puede ser menor que el de un evento publicado antes. Ningún consumidor debe asumir que `ocurridoEn` crece con el id.

## Consecuencias
- Estudio publica `PomodoroCompletado` y `DescansoCompletado` con `ocurridoEn` = fin real (inicio + duración + pausas).
- El RPG asigna el día, el tope y (en la iteración 6) los tramos y la racha por `ocurridoEn` sin cambios de código.
- Riesgo: un módulo podría "fechar hacia atrás" para esquivar un tope diario. Es una app personal y los módulos son propios; el límite es "nunca futuro".
