# Reglas de gamificación v1

Fuente de verdad: **`web/src/modulos/rpg/reglas.v1.json`** (configuración, no código). Este documento la explica. Diseño y razones: ADR-0005 y ADR-0014 (XP por tipo de trabajo).

## 1. Principios
1. **La XP nunca baja.** No hay castigos; perder una racha solo quita el multiplicador.
2. **Se premia el resultado, no la cantidad de clics.** Valor según el tipo de trabajo (dato objetivo, ADR-0014), topes diarios y rendimiento decreciente.
3. **Los módulos no saben de puntos.** Publican eventos; el RPG decide su valor.
4. **Día = día local de Bogotá** (`America/Bogota`); semana = lunes a domingo.

## 2. Tabla evento → experiencia

| Evento | XP | Atributo | Límites y condiciones | Estado |
|---|---|---|---|---|
| `ejemplo.RegistroCreado` | 1 | Disciplina | Máx. 5 XP/día | ✅ fundación |
| `universidad.MateriaCreada` | 5 | Organización | Máx. 20 XP/día · una vez por `materiaId` | ✅ iteración 1 |
| `universidad.TrabajoCreado` | 3 | Organización | Solo si se registra con ≥ 48 h de antelación · máx. 15 XP/día · una vez por `trabajoId` | ✅ iteración 3 |
| `universidad.TrabajoEntregado` | tarea 10 · quiz 15 · taller 20 · exposición 40 · parcial 50 · proyecto 80 | Disciplina | ×1,2 si `aTiempo` · ×1,25 si `peso` ≥ 20 % · 0 si se entrega < 10 min después de crearlo · máx. 300 XP/día · una vez por `trabajoId` (reabrir no da doble premio) | ✅ iteración 3 |
| `universidad.TrabajoCalificado` | 5 | Organización | Una vez por `trabajoId` (corregir la nota no suma) · máx. 25 XP/día. No depende de la nota: se premia registrar, no sacar buena nota | ✅ iteración 3 |
| `universidad.EntregableCreado` / `EntregableCompletado` (v1) | 3 / S 10 · M 35 · L 100 | — | Se conservan para recalcular el historial de la iteración 1; ya no se publican | histórico |
| `estudio.PomodoroCompletado` | 10 | Intelecto | **Provisional (iteración 5): tope de 80 XP/día** (= 8 Pomodoros). En la iteración 6 (R1) se aplican los tramos: 1.º–8.º del día 100 % · 9.º–12.º 50 % · 13.º en adelante 0. El día es el de `ocurridoEn` = fin real (ADR-0016) | ✅ iteración 5 (tope) · tramos en iteración 6 |
| `estudio.DescansoCompletado` | 2 | Bienestar | Máx. 24 XP/día · saltar un descanso no publica | ✅ iteración 5 |
| `calendario.SemanaPlanificada` | 30 | Organización | Una vez por semana ISO | ✅ iteración 2 |
| `calendario.EventoMarcadoCumplido` | 15 | Disciplina | Solo bloques de compromiso (15 min–8 h), marcables desde que empiezan hasta 48 h después · una vez por `ocurrenciaId` · máx. 45 XP/día | ✅ iteración 2 |
| `rpg.SemanaDeRachaCumplida` | 50 | Disciplina | Una vez por semana; no se multiplica por la racha | "una vez" ✅ · racha en iteración RPG |
| `estudio.PomodoroInterrumpido`, `calendario.Evento*`, `universidad.Materia{Editada,Archivada,Restaurada}`, `Trabajo{Editado,Iniciado,Reprogramado,Cancelado,Reabierto,Eliminado}`, subtareas (no publican eventos) | 0 | — | Sin regla = sin XP (evita farmeo) | ✅ |

**Por qué por tipo y no por talla (ADR-0014):** el tipo lo fija el programa de la materia, no una autoevaluación. Partir un proyecto (80) en 4 tareas (40) pierde; el peso alto (≥ 20 %) da ×1,25 sin depender de que se declare. Ejemplo: parcial a tiempo que vale 25 % → 50 × 1,2 × 1,25 = **75 XP**. Un trabajo creado y entregado en menos de 10 min no da nada; las subtareas nunca dan XP.

## 3. Fórmulas

**Nivel:** XP acumulada para alcanzar el nivel *n*:

> XP(n) = ⌊100 · (n − 1)^1,5⌋

| Nivel | 2 | 3 | 5 | 10 | 20 |
|---|---|---|---|---|---|
| XP acumulada | 100 | 282 | 800 | 2 700 | 8 281 |

Con un día típico (~4 Pomodoros + 1 taller a tiempo = 40 + 24 ≈ 64 XP), el nivel 10 llega en unas 4 semanas y el 20 en unos 3 meses.

**Orden de cálculo de un asiento** (función pura `calcularXp` en `modulos/rpg/dominio/reglas.ts`; los pasos 4 y 5 llegan en la iteración RPG):
1. Base: `xp`, `xpPorTalla[talla]` o `xpPorValor.valores[datos[campo]]` (valor desconocido → 0). Exactamente una de las tres.
2. Condiciones: `minMinutosDesdeCreacion`, `minAntelacionHoras`, `unaVezPor` → si no se cumplen, 0.
3. Puntualidad: × `multiplicadorPuntual` si `aTiempo`; luego × `bonoPorUmbral.multiplicador` si `datos[campo] ≥ minimo` (genérico; hoy: peso ≥ 200 décimas de %).
4. Tramos diarios por cantidad (`tramosDiarios`).
5. Racha: × (1 + min(0,05 · semanas, 0,30)), salvo `sinMultiplicadorDeRacha`.
6. Tope diario: `min(xp, limiteDiarioXp − acumuladoHoyDelTipo)`, nunca negativo.
7. Redondeo hacia abajo a entero.

Cada asiento con XP reducida guarda una **nota** visible en Progreso: `limite-diario`, `ya-otorgado` (unaVezPor), `muy-rapido` (minMinutosDesdeCreacion) o `poca-antelacion` (minAntelacionHoras). Un dato que falta en el evento no se adivina: la condición se considera no cumplida (0 XP). "Una vez por" cuenta solo asientos que dieron XP: si el primero dio 0 (p. ej. por el tope diario), uno posterior sí puede premiar.

**Oro:** oro disponible = ⌊XP total / 10⌋ − oro gastado. Se gasta en recompensas que define el usuario (con costo en oro). La XP no se gasta.

## 4. Racha semanal
- Semana **cumplida** si hubo actividad (`PomodoroCompletado`, `TrabajoEntregado` o, del historial, `EntregableCompletado`) en **≥ 4 de 7 días**.
- Cada semana cumplida consecutiva suma +5 % de multiplicador (tope +30 %) y da 50 XP.
- **Comodín:** se gana 1 por cada 4 semanas cumplidas (máximo 2); se consume automáticamente para salvar una semana no cumplida.
- Sin comodines, la racha vuelve a 0. **No se pierde XP, nivel ni oro.**

## 5. Atributos
| Atributo | Qué refleja | Fuentes v1 |
|---|---|---|
| Intelecto | Estudio enfocado | Pomodoros |
| Disciplina | Cumplir lo prometido | Trabajos entregados, bloques de compromiso, rachas |
| Organización | Planear con anticipación | Materias, trabajos registrados con ≥ 48 h, revisión semanal, notas registradas |
| Bienestar | Ritmo sostenible | Descansos completados; el tope de Pomodoros evita premiar jornadas excesivas |

## 6. Logros v1 (iteración 6; definidos en `reglas.v1.json`)
| Logro | Condición | XP |
|---|---|---|
| Primer foco | 1.er Pomodoro completado (`estudio.PomodoroCompletado`) | 10 |
| Semestre en marcha | 5 materias creadas (`universidad.MateriaCreada`) | 10 |
| Puntual | 10 trabajos distintos entregados a tiempo (`universidad.TrabajoEntregado` con `aTiempo`; reabrir y volver a entregar no suma) | 50 |
| Constancia | 4 semanas de racha seguidas | 100 |
| Maratón sano | 8 Pomodoros y 4 descansos completados en un mismo día de Bogotá | 30 |

## 7. Cómo cambiar las reglas
1. Editar `reglas.v1.json` (la app valida al arrancar y muestra los problemas si algo está mal).
2. `npm run check` (la prueba `rpg-dominio.test.ts` valida el archivo).
3. Si el cambio debe aplicarse al pasado: en la iteración RPG se agregará "Recalcular XP" (posible porque el registro de eventos se conserva).
