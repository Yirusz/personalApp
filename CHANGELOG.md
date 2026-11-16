# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

## [0.7.0] — 2026-11-16 · Iteración 6: RPG v1 completo

### Agregado
- **Racha semanal:** una semana (lunes a domingo, Bogotá) se cumple con 4 días activos. Da +50 XP y multiplica la XP (+5 % por semana, hasta +30 %). Cada 4 semanas cumplidas ganas un comodín (máx. 2) que salva una semana floja. Perder la racha no quita XP. Se evalúa al abrir la app y al llegar eventos, semana por semana, sin temporizadores; el cierre es el lunes 00:00 sin gracia (ADR-0017).
- **Logros** definidos en configuración: Primer foco, Semestre en marcha, Puntual, Constancia y Maratón sano. Se desbloquean una sola vez y dan XP de Disciplina.
- **Niveles por atributo** (Intelecto, Disciplina, Organización, Bienestar) con su barra.
- **Recompensas propias:** crear, editar, archivar y restaurar; canjear con oro (nunca queda negativo) y deshacer durante 10 s.
- **Avisos** de nivel, atributo y logros, agrupados en uno: arriba de la pantalla, 5 s o Escape, anunciados por lector de pantalla y sin animación si el sistema lo pide.
- **Historial legible:** "Pomodoro completado", "Trabajo entregado"… (cada módulo declara la etiqueta de sus eventos).
- Progreso en Inicio muestra la racha y los días activos de la semana.
- Núcleo: `ctx.avisos` y `t.existe`.

### Cambiado
- Pomodoros: el tope provisional de 80 XP se reemplaza por tramos diarios (8 × 10 XP, luego 5 XP hasta el 12.º, luego 0 con la nota "tramo reducido").
- RPG: migración v3 (contadores por día, semanas, logros, recompensas y avisos). Al actualizar, los contadores se rellenan una vez desde el libro y se desbloquean los logros que el historial ya cumple.

## [0.6.0] — 2026-11-15 · Iteración 5: Estudio (Pomodoro)

### Agregado
- **Módulo Estudio:** Pomodoro con foco, descanso corto y largo (25/5/15 cada 4, configurable de 5 a 90 min); pausar, reanudar, detener (no cuenta) y saltar descanso.
- **Resistente a congelamiento:** el tiempo sale del reloj (inicio + duración + pausas), no de un contador. Al recargar o volver de una pantalla bloqueada, la fase figura terminada a la hora exacta y se registra una sola vez, aunque haya dos pestañas.
- **Estudiar para** una materia o un trabajo de Universidad (por consulta; "ya no existe" o "sin materia" si falta).
- **Aviso al terminar con la app visible:** tono (Web Audio), vibración y notificación. Mantener la pantalla encendida, opcional, donde el navegador lo permite. Tiempo restante en el título de la pestaña. La pantalla explica qué pasa con la app cerrada.
- **Estadísticas:** hoy, la semana por día y el reparto por materia o trabajo, con barras propias.
- **Calendario:** los focos completados aparecen como bloques hechos ("Estudio: Cálculo II"), y la ficha "Bloque de estudio" está en la barra lateral.
- Tarjeta de Estudio en Inicio.
- Núcleo: `tx.publicar(tipo, datos, { ocurridoEn })` para fechar un hecho cuando pasó de verdad (ADR-0016). Un Pomodoro que terminó a las 23:50 cuenta para ese día aunque se detecte a las 00:10.

### Cambiado
- RPG: tope provisional de 80 XP diarios para Pomodoros completados, hasta que lleguen los tramos (iteración 6).

## [0.5.1] — 2026-11-15 · Correcciones de la iteración 4 (Calendario)

### Corregido
- **Día, semana y mes no se mostraban sin eventos:** en su lugar salía "Aún no tienes eventos". Ahora las tres vistas se dibujan siempre, como en Google Calendar.

### Cambiado
- **Vistas como Google Calendar:**
  - Día y semana: encabezado "LUN 16" (hoy en círculo), las 24 horas en un panel que llena la pantalla, bloques rellenos del color del evento con texto legible. Al abrir, la vista se coloca en lo primero del día o una hora antes de ahora.
  - Mes: celdas grandes que llenan la pantalla, número arriba ("1 de nov" al empezar el mes). Los eventos de todo el día son barras rellenas y continuas entre días; los que tienen hora, punto + hora + título. "+N más" abre el día.
- **Barra lateral de fichas** (abierta por defecto en pantallas anchas; franja arriba en el teléfono):
  - Las fichas se **arrastran con el mouse o con el dedo** hasta el día y la semana, con una vista previa de dónde y a qué hora quedarán.
  - Soltarlas en el mes abre ese día para elegir la hora.
  - Tocar y luego tocar un hueco sigue funcionando.
- **Color libre integrado, sin ventana emergente:** área de saturación y brillo (mouse, dedo o flechas), barra de tono, código hex, 12 colores rápidos y una muestra de cómo se verá.
- Cabecera: en el teléfono el título va arriba completo; "Fichas" y ".ics" a la derecha.

## [0.5.0] — 2026-11-15 · Iteración 4: revisión del Calendario

### Agregado
- **Fichas** (ADR-0015): en día y semana, el panel "Fichas" permite elegir una ficha y tocar un hueco para ponerla (en escritorio, también arrastrarla). Con la ficha activa, tocar lo que creó la quita. Todo con "Deshacer"; Esc suelta la ficha.
- Universidad aporta una ficha por materia activa: **clase semanal** de 2 h durante 16 semanas, vinculada a la materia.
- **Fichas propias** (pantalla Calendario → Fichas): título, color, duración y "solo una vez" o "cada semana durante N semanas".
- Formulario de evento: **"Usar una ficha"** (llena título, color, duración y repetición) y **"Vincular a"** una materia, un trabajo u otra entidad de tus módulos; la ocurrencia muestra el vínculo con enlace.
- **Color libre** (#rrggbb) además de la paleta, ajustado solo para verse bien en tema claro y oscuro.
- Vistas tipo Google/Samsung: cabecera compacta (Hoy ‹ › título), botón flotante "+" en pantallas angostas, **semana de 7 columnas también en 360 px** (tocar un día abre su vista), tocar un hueco crea en esa media hora y arrastrar con el mouse marca el rango; la línea de "ahora" avanza sola.
- Núcleo: `ColorDeAgenda`, lenguaje publicado de fichas y vínculos, `integraciones.fichas()` tolerante a fallos.

### Corregido
- Desbordamiento horizontal del calendario en 360 px.

### Migración
- Calendario v2 agrega el almacén de fichas propias; los eventos existentes no cambian.

## [0.4.0] — 2026-11-15 · Iteración 3: revisión de Universidad

### Agregado
- **Materias** con profesor, periodo académico (sugerido: 2026-2) y color/créditos editables; nombre único por periodo; agrupadas por periodo.
- **Trabajos** (antes "entregables") de tipo tarea, taller, quiz, parcial, proyecto o exposición, con descripción y **peso %** opcional.
- Estados explícitos **pendiente → en progreso → entregado → calificado**, o **cancelado**; "Reabrir" deliberado (avisa que borra la fecha de entrega y la nota). Se guarda la fecha real de entrega y si fue a tiempo.
- **Nota** 0,0–5,0 con un decimal (guardada como entero en décimas).
- **Subtareas** con casillas y barra de progreso (no dan XP).
- **Próximas entregas** agrupadas en Vencido / Hoy / Próximos 7 días / Más adelante, con filtros por materia y estado que se conservan.
- Núcleo: **integración por consulta** (ADR-0013). Un módulo declara `proveedores` (fuentes de calendario y referencias) y los demás los consultan con `ctx.integraciones`, sin importarse ni leer almacenes ajenos.
- Universidad registra la fuente `universidad.entregas` (el calendario muestra estado y color actuales, enlaza a la ficha) y las referencias `universidad.materia` / `universidad.trabajo` para Estudio y Notas.
- RPG: capacidades genéricas `xpPorValor` y `bonoPorUmbral`; reglas `TrabajoCreado` (3), `TrabajoEntregado` (tarea 10 · quiz 15 · taller 20 · exposición 40 · parcial 50 · proyecto 80; ×1,2 a tiempo; ×1,25 si vale ≥ 20 %) y `TrabajoCalificado` (5) (ADR-0014).

### Cambiado
- La talla S/M/L desaparece; el esfuerzo se deduce del tipo (ADR-0014).
- El Calendario consulta las fuentes registradas por rango y omite la copia por eventos de los módulos que ya ofrecen fuente; las fuentes que fallan se informan por nombre.
- "Esta semana" es una ventana móvil de 7 días (antes, en "Próximos vencimientos", 72 h).

### Migración
- Universidad v2 convierte los datos de la iteración 1 (tipos, estados, `completadoEn` → `entregadoEn`, periodo según la fecha de creación). Los eventos `Entregable*` del historial conservan sus reglas de XP.

## [0.3.0] — 2026-11-15 · Iteración 2: Calendario

### Agregado
- Módulo **Calendario** (ADR-0011): eventos con título, inicio–fin o todo el día (fechas sin hora ni zona), lugar, notas y color; eliminar con "Deshacer".
- Repeticiones diaria, semanal (días elegidos) y mensual, cada N, con fin por fecha o número de veces; editar o borrar solo una ocurrencia (con "Deshacer") o toda la serie. Las ocurrencias se calculan solo para lo que se ve.
- Vistas agenda (14 días), día, semana (7 columnas desde 720 px, un día a la vez en el teléfono) y mes (puntos de color en 360 px). Atajos ← → T N; el mes se recorre con flechas, Re Pág/Av Pág y Enter.
- Entregas de Universidad (y de cualquier módulo que publique `datos.agenda`) en el calendario, diferenciadas y de solo lectura. Si una fuente falla, se muestra el resto con un aviso.
- Recordatorios múltiples por evento: notificación con Ludus abierto (si hay permiso) y bandeja "Recordatorios" en Inicio al abrir. La UI explica qué garantiza cada plataforma.
- Importar .ics con vista previa y sin duplicar (por UID); exportar .ics con repeticiones, excepciones, alarmas y, opcionalmente, las entregas. Lector/generador propio sin dependencias (ADR-0012).
- Bloque de compromiso: marcar cumplido da 15 XP de Disciplina (tope 45/día, una vez por ocurrencia). Revisión semanal "Semana planificada" (30 XP, una vez por semana).
- Tarjeta de Inicio con lo de hoy, recordatorios pendientes y la revisión semanal.
- Núcleo: `nucleo/dominio/zona-horaria.ts`, tareas `alIniciar` de módulo, puerto `ctx.notificaciones` (vía Service Worker), `navegar(ruta, { reemplazar })` sin mover el foco.

### Cambiado
- `formatos.entradaLocal/desdeEntradaLocal` usan la nueva conversión de zona del núcleo.

## [0.2.0] — 2026-11-14 · Iteración 1: Universidad

### Agregado
- Módulo **Universidad** (U1–U6): materias con color y créditos; entregables (tarea, trabajo, parcial, otro) con fecha y hora de entrega, prioridad y talla S/M/L; estados pendiente → en curso → completado, reabrir; reprogramar; eliminar con "Deshacer" de 10 s; archivar y restaurar materias con "Deshacer".
- Pantalla Universidad con "Próximos vencimientos" (72 h y vencidos) y filtros por materia y estado que se conservan; tarjeta "Próximas entregas" en Inicio.
- Eventos `universidad.*` con `datos.agenda` (listos para el Calendario) y los datos que necesita el RPG (`antelacionHoras`, `aTiempo`, `minutosDesdeCreacion`, `talla`).
- RPG: el motor aplica `unaVezPor`, `minMinutosDesdeCreacion`, `minAntelacionHoras` y `multiplicadorPuntual` de `reglas.v1.json` (reabrir y volver a completar no da doble premio; completar en menos de 10 min no da XP; puntualidad ×1,2). Notas visibles en el historial de Progreso. Migración v2 del RPG (índice `por_clave_unica`).
- Núcleo y shell: `ElementoDeAgenda` y colores categóricos por token; `formatos.entradaLocal` / `desdeEntradaLocal` / `relativo`; barra "Deshacer" genérica (también Ctrl+Z); utilidades CSS para formularios y listas.

### Cambiado
- `.acciones` centra sus elementos verticalmente.

## [0.1.0] — 2026-11-14 · Fase 1: fundación

### Agregado
- Fase 1: visión, story map, modelo de dominio, arquitectura (C4), reglas de gamificación v1, ADRs 0001–0010, escenarios de calidad y plan maestro.
- Fundación de la PWA `web/`: shell con navegación adaptativa, tema claro/oscuro/sistema, textos en es-CO, manifest y Service Worker escrito a mano.
- Núcleo: registro de módulos con descubrimiento automático, bus de eventos con bandeja de salida (outbox) persistente y cursores por suscriptor, IndexedDB con migraciones por módulo, UUIDv7, `Reloj` inyectable, exportar/importar JSON y pantalla de diagnóstico.
- Módulo `ejemplo` que recorre el contrato de punta a punta y núcleo del módulo `rpg` que registra la experiencia según `reglas.v1.json`.
- `npm run check` (lint, tipos y pruebas) y CI con matriz Windows + Linux.
