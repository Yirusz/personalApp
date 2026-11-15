# Story map — Ludus

Usuario: **yo, estudiante** (único rol). Objetivo: *cumplir el semestre con menos estrés y más constancia*.

## 1. Mapa

El **backbone** (fila superior) son las actividades del usuario en orden. Debajo, las historias de cada actividad, de mayor a menor prioridad. La **línea del MVP** separa lo que sale en la versión 1.0.

| Organizar mi semestre | Planear mi semana | Estudiar | Cumplir y entregar | Ver mi progreso y premiarme | Tomar notas | Cuidar mis datos |
|---|---|---|---|---|---|---|
| U1 Crear materia ✅ | C1 Agenda de próximos días ✅ | E1 Pomodoro con fases | U4 Avanzar estado de un entregable ✅ | R1 Reglas v1 completas | | F1 Exportar/importar ✅ |
| U2 Editar/archivar materia ✅ | C3 Crear/editar evento ✅ | E2 Configurar Pomodoro | U5 Lista y "próximos vencimientos" ✅ | R2 Racha semanal con comodines | | F2 Diagnóstico ✅ |
| U3 Registrar entregable ✅ | C4 Entregables en el calendario ✅ | E3 Aviso al terminar (app visible) | U6 Reprogramar/eliminar ✅ | R3 Logros básicos | | F3 Proteger datos (persistencia) ✅ |
| | C2 Vista semana ✅ | E4 Sesiones y estadísticas | | R4 Recompensas y canje con oro | | |
| | C5 Recordatorios al abrir ✅ | E5 Pomodoro resistente a congelamiento | | R5 Avisos de nivel y logro | | |
| | C6 Revisión semanal ✅ | | | | | |
| **— — — — — — — — LÍNEA DEL MVP — — — — — — — —** | | | | | | |
| U7 Horario semanal de clases (cubierto por C8 ✅) | C7 Vista mes ✅ | E6 Técnicas extra (52/17, flowtime) | U8 Subtareas con checklist | R6 Atributos con niveles propios | N1 Nota Markdown | S1 Sincronizar con Syncthing |
| U8 Notas de calificaciones | C8 Eventos recurrentes ✅ | E7 Estadísticas por rango | | R7 Tema pixel art 8/16 bits | N2 Etiquetas | S2 Respaldo automático a carpeta |
| | C9 Exportar e importar .ics ✅ | E8 Sonidos/ruido de fondo | | R8 Recalcular XP con reglas nuevas | N3 Búsqueda | |
| | | | | | N4 Vincular nota ↔ materia/entregable | |
| | | | | | O1 Exportar/importar notas a Obsidian (.md) | |

✅ = construido (fase 1: fundación; iteración 1: Universidad; iteración 2: Calendario completo, que adelantó C7–C9 por ADR-0011).

**Totales MVP:** Universidad 15 · Calendario 19 · Estudio 15 · RPG 18 → **67 puntos**.

## 2. Convenciones de las historias
- Plantilla de la guía §19. Puntos: escala Fibonacci del contexto teórico (≤ 8; si no, dividir).
- Plataformas: **todas** = Windows y Linux (Chrome, Zen) + Android (Chrome).
- Como todo es local (ADR-0002), el escenario "sin conexión" verifica que **nada cambia** sin red y que no aparece nada "pendiente".
- Horas en `America/Bogota` al mostrar; UTC al guardar.
- Cada historia publica sus eventos; la XP la decide el RPG (`reglas.v1.json`), nunca el módulo.

---

## 3. Historias del MVP

### Universidad (15 pts)

#### U1 — Crear materia · 2 pts · todas
Como estudiante, quiero registrar mis materias del semestre, para organizar entregas y estudio por materia.
```gherkin
Escenario: Crear una materia
  Dado que no tengo materias
  Cuando creo "Cálculo II" con el color verde
  Entonces aparece en la lista de materias
  Y se publica universidad.MateriaCreada

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando creo la materia "Física I"
  Entonces se guarda y aparece igual que con conexión, sin marcas de "pendiente"

Escenario: Nombre repetido
  Dado que tengo la materia activa "Cálculo II"
  Cuando intento crear "cálculo ii"
  Entonces veo "Ya tienes una materia con ese nombre" y no se crea

Escenario: Nombre vacío o largo
  Cuando intento crear una materia con nombre vacío o de más de 60 caracteres
  Entonces el formulario lo indica y no se guarda
```

#### U2 — Editar y archivar materia · 2 pts · todas
Como estudiante, quiero renombrar o archivar una materia, para mantener la lista limpia al terminar el semestre sin perder el historial.
```gherkin
Escenario: Archivar
  Dado que tengo "Cálculo II" con 3 entregables completados
  Cuando la archivo
  Entonces desaparece de las listas activas
  Y sus entregables y sesiones siguen en el historial y en las estadísticas

Escenario: No se agregan entregables a una materia archivada
  Dado que "Cálculo II" está archivada
  Cuando intento registrar un entregable en ella
  Entonces no aparece como opción

Escenario: Deshacer
  Cuando archivo una materia por error y pulso "Deshacer" en los siguientes 10 s
  Entonces vuelve a estar activa

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando renombro una materia
  Entonces el cambio se guarda y se ve en todas las pantallas
```

#### U3 — Registrar entregable · 3 pts · todas
Como estudiante, quiero registrar trabajos, tareas y parciales con fecha de entrega, prioridad y tamaño, para no olvidarlos y planear mi tiempo.
```gherkin
Escenario: Registrar
  Dado que tengo la materia "Física I"
  Cuando registro la tarea "Taller 3" para el viernes a las 23:59, prioridad Alta, talla M
  Entonces aparece en la lista ordenada por fecha
  Y se publica universidad.EntregableCreado con datos.agenda (para el calendario)

Escenario: Fecha en el pasado
  Cuando registro un entregable con fecha anterior a ahora
  Entonces veo una advertencia, pero puedo guardarlo (registro de algo ya vencido)

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando registro un entregable
  Entonces se guarda y aparece en la lista y en el calendario

Escenario: Validación
  Cuando dejo vacío el título o la materia
  Entonces el formulario indica qué falta y no se guarda
```

#### U4 — Avanzar el estado de un entregable · 3 pts · todas
Como estudiante, quiero marcar un entregable como en curso o completado, para saber qué me falta y recibir mi recompensa.
```gherkin
Escenario: Completar a tiempo
  Dado el entregable "Taller 3" (talla M) que vence mañana
  Cuando lo marco como completado
  Entonces queda Completado con la hora actual
  Y se publica universidad.EntregableCompletado con aTiempo = verdadero y talla M

Escenario: La talla se bloquea al empezar
  Dado un entregable en curso
  Cuando intento cambiar su talla
  Entonces no está permitido

Escenario: Reabrir no da doble premio
  Dado un entregable completado
  Cuando lo reabro y lo vuelvo a completar
  Entonces se publica de nuevo EntregableCompletado
  Pero el RPG no otorga XP otra vez (regla unaVezPor: entregableId)

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando completo un entregable
  Entonces se guarda y la XP aparece en Inicio igual que con conexión
```

#### U5 — Lista y "próximos vencimientos" · 3 pts · todas
Como estudiante, quiero ver mis entregables filtrados por materia y estado, y destacados los que vencen en 72 h, para priorizar.
```gherkin
Escenario: Próximos vencimientos
  Dado que tengo 2 entregables que vencen en menos de 72 h y 3 que vencen después
  Cuando abro Universidad
  Entonces veo arriba "Próximos vencimientos" con los 2 primeros, el más cercano primero

Escenario: Filtros
  Cuando filtro por "Física I" y estado Pendiente
  Entonces solo veo esos entregables, y el filtro se conserva al volver

Escenario: Lista vacía
  Dado que no tengo entregables
  Entonces veo un estado vacío con el botón "Registrar entregable"

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Entonces la lista y los filtros funcionan igual
```

#### U6 — Reprogramar o eliminar entregable · 2 pts · todas
Como estudiante, quiero cambiar la fecha de un entregable o eliminarlo, para reflejar cambios del profesor.
```gherkin
Escenario: Reprogramar
  Cuando cambio la fecha de "Taller 3" al lunes
  Entonces se publica universidad.EntregableReprogramado y el calendario lo muestra el lunes

Escenario: Eliminar con deshacer
  Cuando elimino un entregable
  Entonces desaparece, puedo deshacer durante 10 s, y luego se publica universidad.EntregableEliminado

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando reprogramo
  Entonces se guarda y el calendario se actualiza
```

### Universidad v2 (iteración 3: ~21 pts, ADR-0013 y ADR-0014)

Revisión pedida por el usuario: amplía U1–U6. "Entregable" pasa a llamarse **Trabajo**; la talla S/M/L se reemplaza por el tipo (ADR-0014). Los datos de la iteración 1 se migran.

#### U7 — Materias con profesor y periodo · 3 pts · todas
Como estudiante, quiero crear, editar y archivar materias con nombre, profesor, color, periodo académico y créditos opcionales, para organizar cada semestre.
```gherkin
Escenario: Crear y editar
  Dado que estoy en Materias
  Cuando creo "Física I" con profesor "Dra. Pérez", periodo "2026-2" y color azul
  Entonces aparece agrupada bajo "Periodo 2026-2"
  Y al editarla puedo cambiar profesor, color, periodo y créditos

Escenario: Mismo nombre en otro periodo
  Dado que tengo "Cálculo II" en 2026-1
  Cuando creo "cálculo ii" en 2026-2
  Entonces se crea; pero otra "Cálculo II" en 2026-2 muestra "Ya tienes una materia con ese nombre en ese periodo"

Escenario: Archivar con deshacer, sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando archivo "Física I" y pulso "Deshacer"
  Entonces vuelve a las activas
```

#### U8 — Registrar trabajo con tipo y peso · 3 pts · todas
```gherkin
Escenario: Registrar
  Dado que tengo la materia "Física I"
  Cuando registro "Taller 3", tipo taller, mañana 23:59 (Bogotá), prioridad alta, peso 15 %, con descripción
  Entonces queda pendiente y se publica universidad.TrabajoCreado con tipo y peso

Escenario: Validación
  Cuando dejo título vacío y escribo peso "150"
  Entonces se marcan ambos campos a la vez y el foco va al primero

Escenario: Materia archivada
  Dado que "Física I" está archivada
  Entonces no aparece en el selector y el dominio rechaza registrarle trabajos
```

#### U9 — Estados explícitos · 5 pts · todas
```gherkin
Escenario: Ciclo completo
  Dado un trabajo pendiente que vence mañana
  Cuando lo empiezo y luego lo marco entregado hoy
  Entonces queda "Entregado · a tiempo" con la fecha real (Reloj inyectado)
  Y se publica universidad.TrabajoEntregado {tipo, peso, aTiempo}

Escenario: Tarde
  Dado un trabajo que venció hace 3 horas
  Cuando lo marco entregado
  Entonces queda "tarde" y no recibe el bono de puntualidad

Escenario: Transiciones prohibidas
  Dado un trabajo calificado o cancelado
  Entonces no se ofrece "Empezar" ni "Marcar entregado"; solo "Reabrir", que avisa que borra fecha de entrega y nota y lo deja en progreso

Escenario: Cancelar
  Dado un trabajo pendiente o en progreso
  Cuando lo cancelo
  Entonces sale de "Próximas entregas" y del calendario
```

#### U10 — Próximas entregas con indicadores y filtros · 3 pts · todas
```gherkin
Escenario: Agrupación
  Dado trabajos que vencieron ayer, vencen hoy a las 23:00, el martes y en 20 días (hoy es domingo)
  Entonces los veo en "Vencido", "Hoy", "Próximos 7 días" y "Más adelante", en ese orden

Escenario: Filtros que persisten
  Cuando filtro por "Física I" y "Calificados", voy a Inicio y vuelvo
  Entonces el filtro se conserva
```

#### U11 — Subtareas · 3 pts · todas
```gherkin
Escenario: Dividir el trabajo
  Dado el trabajo "Parcial 1"
  Cuando agrego "Repasar cap. 3" y "Hacer ejercicios" y marco la primera
  Entonces veo "1/2 subtareas" y la barra de progreso
  Y no se publica ningún evento (las subtareas no dan XP)
```

#### U12 — Nota del trabajo calificado · 2 pts · todas
```gherkin
Escenario: Registrar nota
  Dado un trabajo entregado
  Cuando escribo "4,2" y pulso "Registrar nota"
  Entonces queda calificado con "Nota 4,2" (se guarda 42) y se publica universidad.TrabajoCalificado

Escenario: Nota inválida
  Cuando escribo "5,7" o "3,75"
  Entonces veo "La nota va de 0,0 a 5,0, con un decimal" y el foco vuelve al campo
```

**Integración (ADR-0013, ~2 pts):** fuente de calendario `universidad.entregas` (las entregas aparecen en el calendario con el color de la materia, se tachan al entregar, enlazan a la ficha; la copia vieja por eventos no se duplica) y referencias `universidad.materia` / `universidad.trabajo` para Estudio y Notas.

### Calendario (iteración 2: ~46 pts, ADR-0011)

La iteración 2 amplió C1–C6 con lo que estaba después de la línea del MVP (C7–C9) y más. Historias como se implementaron (todas ✅, plataformas: todas):

| Historia | Pts | Incluye |
|---|---|---|
| CA1 Eventos propios | 5 | Título, inicio–fin o todo el día (fecha sin zona), lugar, notas, color; eliminar con deshacer (C3) |
| CA2 Fuentes de otros módulos | 3 | `datos.agenda` de solo lectura, diferenciado; tolerante a fallos (C4) |
| CA3 Agenda | 3 | 14 días agrupados por día local (C1) |
| CA4 Día y semana | 5 | Cuadrícula horaria; 7 columnas desde 720 px, un día a la vez en angosto; ← → (C2) |
| CA5 Recurrencia | 5 | Diaria, semanal con días, mensual; cada N; fin por fecha o veces (C8) |
| CA6 Borrar solo una ocurrencia | 2 | Con deshacer |
| CA7 Editar solo una ocurrencia | 3 | Y "volver a la original" |
| CA8 Recordatorios | 5 | Varios por evento; bandeja al abrir; notificación con la app abierta; garantías por plataforma (C5) |
| CA9 Mes | 5 | Puntos de color en 360 px; teclado tipo cuadrícula (C7) |
| CA10 Exportar .ics | 3 | Con RRULE, EXDATE, VALARM y, opcional, los elementos de otros módulos (C9) |
| CA11 Importar .ics | 5 | Vista previa, avisos, sin duplicar por UID |
| CA12 Bloque de compromiso | 2 | `EventoMarcadoCumplido` → XP con tope diario |
| C6 Revisión semanal | 2 | Sin cambios respecto a la historia original |

Criterios Dado/Cuando/Entonces: los de C1–C6 abajo siguen vigentes; los nuevos están como pruebas en `web/src/modulos/calendario/**/*.test.ts` (nombradas por historia).

#### Historias originales (C1–C6)

#### C1 — Agenda de próximos días · 3 pts · todas
Como estudiante, quiero ver una lista por día de mis eventos y vencimientos de los próximos 14 días, para saber qué viene.
```gherkin
Escenario: Agenda agrupada por día
  Dado un evento hoy a las 14:00 y un vencimiento el jueves
  Cuando abro Calendario
  Entonces veo "Hoy" con el evento y "jueves 19 nov" con el vencimiento, en hora de Bogotá

Escenario: Medianoche en Bogotá
  Dado un evento guardado a las 2026-11-15T04:30Z
  Entonces aparece el sábado 14 a las 11:30 p. m.

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Entonces la agenda se muestra completa
```

#### C2 — Vista semana · 5 pts · todas (dos diseños: angosto y ancho)
Como estudiante, quiero ver mi semana completa, para planear bloques de estudio.
```gherkin
Escenario: Escritorio o tableta en horizontal (≥ 720 px)
  Dado que la pantalla es ancha
  Cuando abro la vista semana
  Entonces veo 7 columnas de lunes a domingo con eventos posicionados por hora

Escenario: Teléfono (< 720 px)
  Dado que la pantalla es angosta
  Cuando abro la vista semana
  Entonces veo un día a la vez y deslizo o uso flechas para cambiar de día

Escenario: Navegación con teclado
  Cuando presiono ← o → en la vista semana
  Entonces cambio de semana

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Entonces la vista semana funciona igual
```

#### C3 — Crear, editar y eliminar eventos · 3 pts · todas
Como estudiante, quiero agregar eventos (clases extra, citas, parciales) con recordatorio, para tener todo en un solo lugar.
```gherkin
Escenario: Crear
  Cuando creo "Monitoría de Cálculo" el martes de 10:00 a 11:00 con recordatorio 30 min antes
  Entonces aparece en agenda y semana, y se publica calendario.EventoCreado

Escenario: Invariante de intervalo
  Cuando pongo fin antes del inicio
  Entonces veo "La hora de fin debe ser posterior al inicio" y no se guarda

Escenario: Eliminar con deshacer
  Cuando elimino un evento
  Entonces puedo deshacer durante 10 s

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Cuando creo un evento
  Entonces se guarda igual
```

#### C4 — Entregables (y cualquier módulo) en el calendario · 3 pts · todas
Como estudiante, quiero ver mis vencimientos en el calendario sin registrarlos dos veces, para tener una sola vista del tiempo.
```gherkin
Escenario: Proyección desde eventos
  Dado que Universidad publicó EntregableCreado con datos.agenda
  Entonces el calendario muestra el vencimiento, con el color de la materia
  Y el calendario no importa código de Universidad (solo lee datos.agenda)

Escenario: Completado
  Cuando el entregable se completa
  Entonces el vencimiento aparece tachado

Escenario: Historial previo
  Dado que ya había entregables antes de instalar Calendario
  Cuando se activa el módulo por primera vez
  Entonces aparecen todos (la suscripción procesa el historial)
```

#### C5 — Recordatorios al abrir la app · 3 pts · todas
Como estudiante, quiero ver los recordatorios pendientes al abrir Ludus y una notificación si la tengo abierta, sabiendo que con la app cerrada no hay aviso (ADR-0004).
```gherkin
Escenario: Al abrir
  Dado un evento con recordatorio cuya hora ya pasó mientras la app estaba cerrada
  Cuando abro Ludus
  Entonces veo una bandeja "Recordatorios" en Inicio con ese evento

Escenario: Con la app abierta y permiso concedido
  Dado que Ludus está visible y di permiso de notificaciones
  Cuando llega la hora del recordatorio
  Entonces aparece una notificación del sistema

Escenario: Permiso denegado
  Dado que negué el permiso
  Entonces el recordatorio aparece solo dentro de la app, sin errores
```

#### C6 — Revisión semanal · 2 pts · todas
Como estudiante, quiero marcar que planifiqué mi semana, para crear el hábito (y ganar XP de Organización).
```gherkin
Escenario: Planificar
  Dado que es la semana 47 y no la he revisado
  Cuando pulso "Semana planificada"
  Entonces se publica calendario.SemanaPlanificada con semana "2026-W47"

Escenario: Una vez por semana
  Dado que ya la marqué
  Entonces el botón muestra "Planificada ✓" y no publica otra vez
```

### Estudio (15 pts)

#### E1 — Pomodoro con fases · 5 pts · todas
Como estudiante, quiero un temporizador Pomodoro (foco/descanso corto/descanso largo), opcionalmente ligado a una materia, para estudiar concentrado.
```gherkin
Escenario: Ciclo completo
  Dada la configuración 25/5/15 con descanso largo cada 4
  Cuando inicio foco para "Cálculo II" y pasan 25 min
  Entonces la sesión se completa, se publica estudio.PomodoroCompletado con materiaId y minutosFoco 25
  Y se propone el descanso corto

Escenario: Interrumpir
  Cuando detengo el foco a los 10 min
  Entonces se publica estudio.PomodoroInterrumpido (sin XP)

Escenario: Una sola sesión activa
  Dado un foco en curso
  Cuando intento iniciar otro
  Entonces se me ofrece ir al que está en curso

Escenario: Sin conexión
  Dado que el dispositivo no tiene conexión
  Entonces el temporizador funciona igual
```

#### E2 — Configurar Pomodoro · 2 pts · todas
Como estudiante, quiero ajustar duraciones y ciclos, para adaptarlos a mi forma de estudiar.
```gherkin
Escenario: Guardar
  Cuando pongo foco 50, descanso 10, largo 20, cada 3
  Entonces las próximas sesiones usan esos valores

Escenario: Límites
  Cuando pongo foco 0 o 200 min
  Entonces se indica el rango válido (5–90) y no se guarda
```

#### E3 — Aviso al terminar (app visible) · 3 pts · todas (vibración solo Android)
Como estudiante, quiero un aviso sonoro, vibración y notificación al terminar una fase si tengo Ludus abierto, para no mirar el reloj.
```gherkin
Escenario: App visible
  Dado un foco en curso y Ludus visible
  Cuando termina
  Entonces suena un tono, vibra (si el dispositivo puede) y aparece una notificación si hay permiso

Escenario: Sin capacidades
  Dado un navegador sin vibración ni notificaciones
  Entonces solo suena el tono y se ve el aviso en pantalla, sin errores
```

#### E4 — Sesiones y estadísticas simples · 3 pts · todas
Como estudiante, quiero ver cuánto estudié hoy y esta semana, por materia, para equilibrar mi tiempo.
```gherkin
Escenario: Resumen
  Dado 4 Pomodoros de Cálculo y 2 de Física hoy
  Cuando abro Estudio
  Entonces veo "Hoy: 2 h 30 min" y el reparto por materia

Escenario: Estado vacío
  Dado que no he estudiado esta semana
  Entonces veo un estado vacío con "Empezar un Pomodoro"
```

#### E5 — Pomodoro resistente a congelamiento · 2 pts · Android
Como estudiante, quiero que el temporizador sea correcto aunque Android congele la app, para confiar en él.
```gherkin
Escenario: Volver tras bloquear la pantalla
  Dado que en Android inicio un foco de 25 min y bloqueo la pantalla
  Cuando vuelvo a los 30 min
  Entonces la sesión figura completada a los 25 min exactos (hora de inicio + duración, no ticks)
  Y se publicó PomodoroCompletado una sola vez

Escenario: Recargar la página
  Dado un foco en curso
  Cuando recargo Ludus
  Entonces el temporizador continúa con el tiempo restante correcto
```

### RPG (18 pts)

#### R1 — Reglas v1 completas · 5 pts · todas
Como estudiante, quiero que la experiencia premie el esfuerzo real, para que el juego no se pueda "farmear".
```gherkin
Escenario: Puntualidad
  Cuando completo a tiempo un entregable talla M
  Entonces gano 42 XP (35 × 1,2) de Disciplina

Escenario: Completado demasiado rápido
  Cuando completo un entregable 5 min después de crearlo
  Entonces gano 0 XP y el historial dice "completado muy rápido"

Escenario: Rendimiento decreciente
  Dados 12 Pomodoros completados hoy
  Entonces gané 8 × 10 + 4 × 5 = 100 XP de Intelecto, y el 13.º da 0

Escenario: Planificación anticipada
  Cuando registro un entregable 3 días antes de su fecha
  Entonces gano 3 XP de Organización; si es con menos de 48 h, 0
```

#### R2 — Racha semanal con comodines · 5 pts · todas
Como estudiante, quiero una racha semanal flexible, para mantener la constancia sin miedo a perderlo todo.
```gherkin
Escenario: Semana cumplida
  Dado que estuve activo 4 de 7 días (lun–dom, hora de Bogotá)
  Cuando empieza la semana siguiente
  Entonces se publica rpg.SemanaDeRachaCumplida (+50 XP) y la racha sube a 1

Escenario: Multiplicador
  Dada una racha de 3 semanas
  Entonces la XP de los eventos se multiplica por 1,15 (tope 1,30)

Escenario: Comodín
  Dada una racha de 5 semanas y 1 comodín
  Cuando una semana no cumplo
  Entonces se consume el comodín y la racha sigue

Escenario: Perder la racha
  Dada una racha sin comodines
  Cuando una semana no cumplo
  Entonces el multiplicador vuelve a 1, pero conservo toda mi XP, nivel y oro
```

#### R3 — Logros básicos · 3 pts · todas
Como estudiante, quiero desbloquear logros por hitos, para celebrar avances.
```gherkin
Escenario: Primer Pomodoro
  Cuando completo mi primer Pomodoro
  Entonces se desbloquea "Primer foco" y se publica rpg.LogroDesbloqueado

Escenario: Idempotencia
  Cuando vuelvo a cumplir la condición
  Entonces el logro no se repite
```

#### R4 — Recompensas propias y canje · 3 pts · todas
Como estudiante, quiero definir recompensas (p. ej. "1 capítulo de serie = 30 de oro") y canjearlas, para darme premios reales.
```gherkin
Escenario: Canjear
  Dado que tengo 50 de oro y la recompensa "Serie" cuesta 30
  Cuando la canjeo
  Entonces me quedan 20 de oro y se publica rpg.RecompensaCanjeada

Escenario: Oro insuficiente
  Dado que tengo 10 de oro
  Entonces el botón "Canjear" está desactivado y dice cuánto falta

Escenario: Deshacer canje
  Cuando deshago un canje en los siguientes 10 s
  Entonces recupero el oro
```

#### R5 — Avisos de nivel y logro · 2 pts · todas
Como estudiante, quiero ver un aviso breve cuando subo de nivel o desbloqueo un logro, para sentir el progreso.
```gherkin
Escenario: Subir de nivel
  Cuando se publica rpg.NivelAlcanzado
  Entonces aparece un aviso "¡Nivel 3!" que se cierra solo en 5 s o con Escape
  Y respeta prefers-reduced-motion (sin animación)
```
