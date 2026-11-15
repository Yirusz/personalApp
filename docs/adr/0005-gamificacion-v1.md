# ADR-0005: Diseño de la gamificación v1

Estado: aceptado (el usuario delegó la decisión; se ajusta con el uso)
Fecha: 2026-11-14

## Contexto
El RPG debe motivar a cumplir (estudiar, entregar a tiempo, planificar) sin crear incentivos perversos:
- **Farmear:** partir tareas o crear eventos triviales para sumar puntos.
- **Abandono por pérdida:** romper una racha o perder puntos desmotiva y lleva a dejar la app.
- **Sobre-estudio:** premiar horas sin límite empuja a jornadas insanas.

Requisito de arquitectura: los módulos no conocen al RPG; publican eventos y el RPG decide el valor desde **configuración**.

## Opciones consideradas
1. **XP solo positiva, ponderada por esfuerzo, con límites diarios y rachas semanales flexibles** (sin penalizaciones).
2. XP con penalizaciones (restar por entregas tarde o días sin estudiar): más "realista" pero aumenta el abandono.
3. Puntos por conteo de acciones (1 tarea = N puntos): trivial de farmear.

## Decisión
Opción 1, con estas reglas (detalle numérico en `docs/gamificacion.md` y `web/src/modulos/rpg/reglas.v1.json`):
- **La XP nunca baja.** No hay penalizaciones.
- **Esfuerzo declarado:** cada entregable tiene talla S/M/L fijada al crearlo (bloqueada una vez iniciado). Valores superlineales (S 10, M 35, L 100) para que partir una L en varias M/S no rinda más.
- **Anti-farmeo:** un entregable completado menos de 10 min después de creado da 0 XP; topes diarios por tipo de evento; rendimiento decreciente en Pomodoros (completa hasta 8/día, 50 % del 9 al 12, 0 desde el 13).
- **Bonificación por puntualidad** (×1,2 si se entrega a tiempo), nunca castigo por tardanza.
- **Rachas semanales flexibles:** semana cumplida si hay actividad en ≥ 4 de 7 días (configurable). Multiplicador +5 % por semana consecutiva, máximo +30 %. **Comodín** automático: 1 por cada 4 semanas cumplidas (máximo 2) que salva una semana fallida. Perder la racha solo reinicia el multiplicador.
- **Atributos (4):** Intelecto (estudio), Disciplina (cumplimiento), Organización (planificación), Bienestar (descansos y límites sanos).
- **Moneda "oro"** separada de la XP: 1 oro por cada 10 XP. Se gasta en recompensas que el usuario define (con costo en oro). La XP no se gasta.
- **Nivel:** XP acumulada para alcanzar el nivel n = ⌊100 · (n − 1)^1,5⌋.
- **Logros:** hitos únicos (primer Pomodoro, primera semana cumplida, 10 entregas a tiempo...), con XP fija.

## Consecuencias
- Las reglas viven en un JSON versionado; cambiarlas no toca código de módulos. Recalcular la XP histórica con reglas nuevas es posible porque el registro de eventos se conserva (ADR-0009).
- La talla declarada depende de la honestidad del usuario; es aceptable en una app personal.
- Deuda: calibrar números tras 2–3 semanas de uso real.
