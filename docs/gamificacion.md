# Reglas de gamificación v1

Fuente de verdad: **`web/src/modulos/rpg/reglas.v1.json`** (configuración, no código). Este documento la explica. Diseño y razones: ADR-0005.

## 1. Principios
1. **La XP nunca baja.** No hay castigos; perder una racha solo quita el multiplicador.
2. **Se premia el resultado, no la cantidad de clics.** Esfuerzo declarado (talla), topes diarios y rendimiento decreciente.
3. **Los módulos no saben de puntos.** Publican eventos; el RPG decide su valor.
4. **Día = día local de Bogotá** (`America/Bogota`); semana = lunes a domingo.

## 2. Tabla evento → experiencia

| Evento | XP | Atributo | Límites y condiciones | Estado |
|---|---|---|---|---|
| `ejemplo.RegistroCreado` | 1 | Disciplina | Máx. 5 XP/día | ✅ fundación |
| `universidad.MateriaCreada` | 5 | Organización | Máx. 20 XP/día · una vez por `materiaId` | ✅ iteración 1 |
| `universidad.EntregableCreado` | 3 | Organización | Solo si se registra con ≥ 48 h de antelación · máx. 15 XP/día · una vez por `entregableId` | ✅ iteración 1 |
| `universidad.EntregableCompletado` | S 10 · M 35 · L 100 | Disciplina | ×1,2 si `aTiempo` · 0 si se completa < 10 min después de crearlo · máx. 300 XP/día · una vez por `entregableId` | ✅ iteración 1 |
| `estudio.PomodoroCompletado` | 10 | Intelecto | 1.º–8.º del día: 100 % · 9.º–12.º: 50 % · 13.º en adelante: 0 | iteración RPG |
| `estudio.DescansoCompletado` | 2 | Bienestar | Máx. 24 XP/día | ✅ |
| `calendario.SemanaPlanificada` | 30 | Organización | Una vez por semana ISO | ✅ iteración 2 |
| `calendario.EventoMarcadoCumplido` | 15 | Disciplina | Solo bloques de compromiso (15 min–8 h), marcables desde que empiezan hasta 48 h después · una vez por `ocurrenciaId` · máx. 45 XP/día | ✅ iteración 2 |
| `rpg.SemanaDeRachaCumplida` | 50 | Disciplina | Una vez por semana; no se multiplica por la racha | "una vez" ✅ · racha en iteración RPG |
| `estudio.PomodoroInterrumpido`, `calendario.Evento*`, `universidad.Materia{Renombrada,Archivada,Restaurada}`, `Entregable{Editado,Iniciado,Reprogramado,Reabierto,Eliminado}` | 0 | — | Sin regla = sin XP (evita farmeo) | ✅ |

**Por qué la talla es superlineal:** partir una L (100) en 3 M da 105 (≈ neutro, y cada M exige su propio registro y plazo); partir una M (35) en 3 S da 30 (pierde). Un entregable creado y completado en menos de 10 min no da nada.

## 3. Fórmulas

**Nivel:** XP acumulada para alcanzar el nivel *n*:

> XP(n) = ⌊100 · (n − 1)^1,5⌋

| Nivel | 2 | 3 | 5 | 10 | 20 |
|---|---|---|---|---|---|
| XP acumulada | 100 | 282 | 800 | 2 700 | 8 281 |

Con un día típico (~4 Pomodoros + 1 entregable M a tiempo ≈ 80–100 XP), el nivel 10 llega en unas 4 semanas y el 20 en unos 3 meses.

**Orden de cálculo de un asiento** (función pura `calcularXp` en `modulos/rpg/dominio/reglas.ts`; los pasos 4 y 5 llegan en la iteración RPG):
1. Base: `xp` o `xpPorTalla[talla]` (talla desconocida → 0).
2. Condiciones: `minMinutosDesdeCreacion`, `minAntelacionHoras`, `unaVezPor` → si no se cumplen, 0.
3. Puntualidad: × `multiplicadorPuntual` si `aTiempo`.
4. Tramos diarios por cantidad (`tramosDiarios`).
5. Racha: × (1 + min(0,05 · semanas, 0,30)), salvo `sinMultiplicadorDeRacha`.
6. Tope diario: `min(xp, limiteDiarioXp − acumuladoHoyDelTipo)`, nunca negativo.
7. Redondeo hacia abajo a entero.

Cada asiento con XP reducida guarda una **nota** visible en Progreso: `limite-diario`, `ya-otorgado` (unaVezPor), `muy-rapido` (minMinutosDesdeCreacion) o `poca-antelacion` (minAntelacionHoras). Un dato que falta en el evento no se adivina: la condición se considera no cumplida (0 XP). "Una vez por" cuenta solo asientos que dieron XP: si el primero dio 0 (p. ej. por el tope diario), uno posterior sí puede premiar.

**Oro:** oro disponible = ⌊XP total / 10⌋ − oro gastado. Se gasta en recompensas que define el usuario (con costo en oro). La XP no se gasta.

## 4. Racha semanal
- Semana **cumplida** si hubo actividad (`PomodoroCompletado` o `EntregableCompletado`) en **≥ 4 de 7 días**.
- Cada semana cumplida consecutiva suma +5 % de multiplicador (tope +30 %) y da 50 XP.
- **Comodín:** se gana 1 por cada 4 semanas cumplidas (máximo 2); se consume automáticamente para salvar una semana no cumplida.
- Sin comodines, la racha vuelve a 0. **No se pierde XP, nivel ni oro.**

## 5. Atributos
| Atributo | Qué refleja | Fuentes v1 |
|---|---|---|
| Intelecto | Estudio enfocado | Pomodoros |
| Disciplina | Cumplir lo prometido | Entregables completados, rachas |
| Organización | Planear con anticipación | Materias, entregables registrados con tiempo, revisión semanal |
| Bienestar | Ritmo sostenible | Descansos completados; el tope de Pomodoros evita premiar jornadas excesivas |

## 6. Logros v1 (iteración RPG)
| Logro | Condición | XP |
|---|---|---|
| Primer foco | 1.er Pomodoro completado | 10 |
| Semestre en marcha | 5 materias creadas | 10 |
| Puntual | 10 entregables completados a tiempo | 50 |
| Constancia | 4 semanas de racha seguidas | 100 |
| Maratón sano | 8 Pomodoros y 4 descansos en un mismo día | 30 |

## 7. Cómo cambiar las reglas
1. Editar `reglas.v1.json` (la app valida al arrancar y muestra los problemas si algo está mal).
2. `npm run check` (la prueba `rpg-dominio.test.ts` valida el archivo).
3. Si el cambio debe aplicarse al pasado: en la iteración RPG se agregará "Recalcular XP" (posible porque el registro de eventos se conserva).
