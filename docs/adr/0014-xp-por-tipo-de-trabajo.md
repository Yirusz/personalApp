# ADR-0014: XP por tipo de trabajo en lugar de talla S/M/L

Estado: aceptado (elegido por el usuario en la iteración 3)
Fecha: 2026-11-15
Modifica: ADR-0005 (punto "Esfuerzo declarado").

## Contexto
ADR-0005 premiaba cada entregable según una talla S/M/L declarada al crearlo. La revisión de Universidad introduce **tipos** (tarea, taller, quiz, parcial, proyecto, exposición) y un **peso % opcional** en la nota, y pide que `TrabajoEntregado` lleve tipo y peso. Mantener además la talla duplicaba el esfuerzo declarado en dos campos.

## Opciones consideradas
1. **XP por tipo** con valores fijos en la configuración, más bonificación por peso alto. El tipo es un dato objetivo (lo dice el programa de la materia), no una autoevaluación.
2. Mantener la talla y además el tipo: dos campos para lo mismo; el usuario no sabe cuál cuenta.
3. XP proporcional al peso: sin peso (es opcional) no habría XP, y premia partir un 30 % en tres de 10 %.

## Decisión
Opción 1, en `reglas.v1.json` con dos capacidades **genéricas** nuevas del motor del RPG (ninguna lógica de puntos en Universidad):
- `xpPorValor {campo, valores}`: XP base según el valor de un campo del evento. `universidad.TrabajoEntregado`: tarea 10, quiz 15, taller 20, exposición 40, parcial 50, proyecto 80 (Disciplina).
- `bonoPorUmbral {campo, minimo, multiplicador}`: peso ≥ 20 % (`200` décimas) → ×1,25.
- Se conservan las salvaguardas de ADR-0005: ×1,2 por puntualidad, 0 XP si se entrega < 10 min después de crearlo, una vez por trabajo (reabrir no da doble premio), tope diario 300.
- `TrabajoCreado` da 3 XP de Organización si se registra con ≥ 48 h de antelación (tope 15/día); `TrabajoCalificado` 5 XP (una vez por trabajo; corregir la nota no suma). Las **subtareas no publican eventos**.
- **Notas** como valor objeto entero en décimas (0–50 ↔ 0,0–5,0); el **peso** en décimas de % (1–1000). Sin flotantes en el dominio.

## Consecuencias
- La talla desaparece; los datos de la iteración 1 se migran (sin talla, `trabajo` → taller, `otro` → tarea). Los eventos `Entregable*` históricos conservan sus reglas, así recalcular la XP da lo mismo que antes.
- El valor de un tipo no depende de la honestidad del usuario, pero dos parciales distintos valen igual (aceptable; el peso matiza).
- Deuda: calibrar números tras unas semanas de uso real.
