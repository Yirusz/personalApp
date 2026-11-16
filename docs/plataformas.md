# Plataformas — Ludus

## Matriz de soporte

| Entorno | Navegador | Instalación como app | Notas |
|---|---|---|---|
| Windows 11 | Chrome / Edge | ✅ Sí | Referencia de escritorio. |
| Windows 11 | Zen (basado en Firefox) | ⚠️ No verificado | Funciona en pestaña. Sin acceso a carpetas (irrelevante en el MVP). Pide permiso al "proteger datos". |
| Linux | Chrome / Chromium | ✅ Sí | |
| Linux | Zen | ❌ (Firefox en Linux aún no instala PWA a nov. 2026) | Funciona en pestaña, también sin conexión. |
| Android | Chrome — Galaxy Tab S10 FE | ✅ Sí (WebAPK) | En horizontal usa el riel lateral (≥ 720 px). |
| Android | Chrome — Galaxy A56 | ✅ Sí (WebAPK) | Dispositivo de referencia para rendimiento. |

Requisitos mínimos: navegador con `light-dark()` de CSS (Chrome ≥ 123, Firefox ≥ 120), IndexedDB y módulos ES. Android 10+.

## Instalar la app

1. Abrir la URL publicada (GitHub Pages, ver README) en HTTPS.
2. **Chrome escritorio:** ícono de instalar en la barra de direcciones → "Instalar".
3. **Chrome Android:** menú ⋮ → "Agregar a la pantalla principal" → "Instalar".
4. **Zen:** usar en una pestaña (fijarla); funciona igual, sin ventana propia.
5. En Ajustes → "Pedir al navegador que no borre mis datos" y exportar un primer respaldo.

## Probar en Android durante el desarrollo

El Service Worker exige HTTPS o `localhost`; `http://192.168.x.x` **no** sirve.

**Opción A — reenvío de puertos por USB (recomendada):**
1. En el teléfono: Opciones de desarrollador → Depuración USB.
2. En el PC: `npm run dev` (puerto 5173) y abrir `chrome://inspect/#devices` en Chrome.
3. "Port forwarding…" → `5173` → `localhost:5173` → activar.
4. En el teléfono abrir `http://localhost:5173` (contexto seguro).
5. Para ver y controlar el teléfono desde el PC: `scrcpy` (Apache-2.0).

> Nota: en modo desarrollo el Service Worker está desactivado a propósito. Para probar la instalación y el modo sin conexión usar `npm run build && npm run preview -- --host` con reenvío del puerto 4173, o la versión publicada en Pages.

**Opción B — GitHub Pages:** cada push a `main` publica la app (workflow `pages.yml`).

## Checklist manual por iteración (Definition of Done)

| Verificar | Win Chrome | Win Zen | Linux Chrome | Linux Zen | Tab S10 FE | A56 |
|---|---|---|---|---|---|---|
| Criterios de aceptación de la iteración | | | | | | |
| Sin conexión (modo avión) tras la primera carga | | | | | | |
| Tema claro / oscuro | | | | | | |
| Botón atrás de Android regresa de pantalla | n/a | n/a | n/a | n/a | | |
| Teclado virtual no tapa los campos | n/a | n/a | n/a | n/a | | |
| Operable solo con teclado (Tab, Enter, Escape) | | | | | n/a | n/a |
| 360 / 768 / 1280 px sin desbordes | | | | | | |
| Exportar e importar respaldo | | | | | | |

### Iteración 1 — Universidad (guion de prueba manual, ~10 min por entorno)
1. **Materias:** Universidad → Materias. Pulsar "Crear materia" vacío → error en el campo y foco en él. Crear "Cálculo II" (verde) y "Física I" (azul). Intentar "cálculo ii" → "Ya tienes una materia con ese nombre".
2. **Registrar:** "Registrar entregable" sin llenar nada → se marcan materia (si hay varias), título y fecha. Registrar "Taller 3" de Física I para mañana 23:59, Alta, M. Registrar uno con fecha de ayer → aviso amarillo "ya pasó", se guarda como vencido.
3. **Lista:** aparecen arriba en "Próximos vencimientos" (el vencido primero). Filtrar por Física I + Completados, ir a Inicio y volver: el filtro se conserva.
4. **Estado:** abrir "Taller 3" → Empezar → la talla queda deshabilitada. Completar → en Progreso aparece la XP (0 con nota "completado muy rápido" si fue antes de 10 min: es la regla anti-farmeo). Reabrir y completar otra vez → no suma XP ("ya se premió antes").
5. **Reprogramar / eliminar:** cambiar la fecha y guardar. "Eliminar entregable" → desaparece y aparece "Deshacer" 10 s; deshacer → vuelve. Repetir sin deshacer → se elimina.
6. **Archivar:** archivar Física I → Deshacer (o Ctrl+Z en escritorio) → vuelve. Archivarla de nuevo → ya no aparece en el selector de materia al registrar; en "Archivadas" se puede restaurar.
7. **Sin conexión:** modo avión, recargar y repetir 2 y 4: todo funciona igual, sin marcas de "pendiente".
8. **Android:** el botón atrás regresa de la ficha del entregable a la lista; el teclado virtual no tapa el campo de título; los botones se pueden tocar sin errores (objetivos ≥ 48 px).

### Iteración 2 — Calendario (guion de prueba manual, ~15 min por entorno)
1. **Evento y validación:** Calendario → "+ Nuevo evento". Crear sin título → error en el campo. Poner el fin antes del inicio → "El final debe ser posterior al inicio".
2. **Serie:** "Física I" mañana 7:00–9:00, Repetir cada semana, lunes y miércoles, termina después de 10 veces, recordatorio 30 min. Aparece en agenda, día, semana y mes a las 7:00.
3. **Todo el día:** "Receso" del 31 dic al 1 ene → en el mes aparece en ambos días (cambio de año).
4. **Ocurrencias:** abrir una clase → "Borrar solo esta" → "Deshacer". "Editar solo esta" → cambiar el título → se ve ✎ y "volver a la original".
5. **Otros módulos:** registrar una entrega en Universidad → aparece en el calendario con borde punteado, 🔒 y "solo lectura"; al completarla se tacha.
6. **Vistas y teclado (escritorio):** ← → cambian de semana; T vuelve a hoy; N crea un evento. En el mes: Tab hasta la cuadrícula, flechas, Re Pág/Av Pág y Enter abre el día.
7. **360 px / Android:** el mes muestra puntos de color; la semana se ve un día a la vez con la tira L–D. El botón atrás sale del calendario (no recorre las semanas visitadas).
8. **Recordatorios:** crear un evento que empiece en 5 min con recordatorio de 10 min. Con permiso: notificación del sistema con Ludus abierto. Ir a Inicio → bandeja "Recordatorios" → Descartar. En Android, cerrar Ludus antes de la hora: no hay notificación (esperado, ADR-0004); al abrir aparece en la bandeja.
9. **Bloque de compromiso:** evento marcado como bloque que ya empezó → "Marcar cumplido" → Progreso suma 15 XP; desmarcar y volver a marcar no suma.
10. **.ics:** Importar el .ics de Moodle o Google → vista previa con avisos → Importar; reimportar el mismo archivo → "0 nuevos y N actualizados". Exportar → abrir el archivo en Google Calendar o en el calendario del teléfono: las alarmas sí suenan con Ludus cerrado.
11. **Sin conexión:** modo avión, recargar el calendario y crear un evento: todo funciona.
12. **Revisión semanal:** en la vista semana o en Inicio, "Semana planificada" → "Planificada ✓" y +30 XP una sola vez.

### Iteración 3 — Revisión de Universidad (guion de prueba manual, ~12 min por entorno)
1. **Datos viejos:** si ya usabas la 0.2/0.3, abrir Universidad: tus entregables aparecen como trabajos (trabajo → taller, otro → tarea; completados → entregados) y la XP no cambia.
2. **Materias:** crear "Física I" (Dra. Pérez, 2026-2, azul) y "Cálculo II". Intentar otra "cálculo ii" en 2026-2 → error; en 2026-1 → se crea. Editar Cálculo II: profesor y color morado → el color cambia también en el calendario.
3. **Registrar:** "Registrar trabajo" con título vacío y peso 150 → ambos errores a la vez. Registrar un taller vencido (hace 3 h, 15 %), un quiz para hoy 23:00, un parcial para pasado mañana (25 %) y un proyecto para dentro de 20 días.
4. **Próximas entregas:** se ven los grupos Vencido / Hoy / Próximos 7 días / Más adelante con etiquetas de color.
5. **Ficha:** abrir el parcial → agregar 2 subtareas (Enter) y marcar una → "1/2". Empezar → Marcar entregado → "a tiempo". Nota "5,7" → error y foco en el campo; "4,2" → "Nota 4,2". Tipo y peso quedan bloqueados. Reabrir → vuelve a "En progreso" sin nota.
6. **XP:** en Progreso, entregar en menos de 10 min tras crearlo da 0 ("muy rápido"); reabrir y volver a entregar no suma. Para ver los 75 XP de un parcial a tiempo con peso ≥ 20 %, crearlo y entregarlo con más de 10 min de diferencia.
7. **Calendario:** las entregas aparecen con el color de la materia, 🔒 y "de Universidad"; la entregada sale tachada con ✓; tocarla abre la ficha del trabajo. No hay duplicados.
8. **Filtros, deshacer, sin conexión:** filtrar "Calificados", recargar → se conserva. Eliminar un trabajo → Deshacer. Archivar una materia → Deshacer (Ctrl+Z en escritorio). En modo avión, recargar y registrar/entregar: todo funciona.
9. **Android:** el teclado numérico aparece en peso y nota; atrás vuelve de la ficha a la lista; los botones de subtarea (✕) se tocan sin errores.

### Iteración 4 — Revisión del Calendario (0.5.1; guion de prueba manual, ~12 min por entorno)
1. **Sin eventos:** en un perfil nuevo, Calendario → Día, Semana y Mes muestran la cuadrícula (no el mensaje de "sin eventos").
2. **Preparar:** en Universidad, crear "Cálculo II" (verde) y "Física I" (azul).
3. **Barra lateral (escritorio y tableta):** en Semana, la barra "Fichas" está a la izquierda. Arrastrar "Cálculo II" al lunes 7:00: mientras se mueve se ve "Cálculo II · 7:00 a. m."; al soltar aparece "Deshacer". Repetir en miércoles. La semana siguiente las clases siguen ahí.
4. **Mes:** arrastrar "Física I" a un día del mes → se abre ese día con "Elige la hora"; tocar las 3:00 p. m. → queda puesta.
5. **Teléfono (Android):** "▦" abre la franja de fichas; arrastrar una ficha hacia abajo con el dedo hasta la semana (7 columnas) la pone; deslizar de lado mueve la franja.
6. **Quitar:** tocar una ficha (queda con ✓) → las clases que puso muestran ✕; tocar una → se quita la serie, con "Deshacer". "Listo" o Esc suelta la ficha.
7. **Vistas:** Día muestra "LUN 16" y las 24 horas desplazando; Mes: barras rellenas para todo el día (continuas entre días) y "● 7:00 título" para lo que tiene hora.
8. **Color:** "+ Nuevo evento" → Color → "Otro": el selector aparece en la página (sin ventana). Probar el área con mouse/dedo y con flechas, la barra de tono, escribir #e65100 y los colores rápidos. En tema oscuro el color se aclara para leerse.
9. **Formulario con ficha y vínculo, sin conexión, recordatorios e .ics:** igual que en la 0.5.0.

### Iteración 5 — Estudio (guion de prueba manual, ~15 min por entorno)
1. **Vacío:** Estudio muestra 25:00, "Siguiente: foco de 25 min" y "Aún no has estudiado esta semana" con "Empezar un Pomodoro".
2. **Vínculo:** con materias en Universidad, "Estudiar para" lista Materias y Trabajos pendientes. Elegir "Cálculo II" → "▶ Iniciar foco". El anillo avanza y la pestaña dice "24:59 · Estudio · Ludus" (escritorio).
3. **Pausar/reanudar:** pausar 1 min y reanudar → "Termina a las…" se corre 1 min.
4. **Recargar:** con el foco en curso, recargar (F5 o deslizar): el tiempo sigue correcto.
5. **Aviso con la app visible:** en Ajustes poner foco 5 min (el mínimo) y dar permiso de notificaciones. Al terminar: tono, vibración (Android) y notificación. Sin permiso, solo tono y el aviso en pantalla.
6. **Congelamiento (Android, A56 y Tab S10 FE):** iniciar un foco de 5 min, bloquear la pantalla 8 min y volver: figura "Foco terminado a las …" con la hora exacta del fin (inicio + 5 min), sin tono tardío, y suma una sola vez en Progreso.
7. **Dos pestañas (escritorio):** abrir Ludus en dos pestañas con el mismo foco; al terminar, Progreso suma 10 XP una sola vez.
8. **Detener y saltar:** detener un foco a la mitad → "Foco detenido…: no cuenta" (sin XP). En un descanso, "⏭ Saltar descanso" → se propone el foco.
9. **Ajustes:** foco 200 → error en el campo y foco en él; 50 → "Guardado"; el foco en curso no cambia. "Pantalla encendida" aparece solo si el navegador la soporta (Chrome Android sí): con ella activa la pantalla no se apaga durante el foco.
10. **Estadísticas y calendario:** tras completar focos, Estudio muestra hoy, la semana por día y el reparto por materia. En el Calendario, vista día, aparece "Estudio: Cálculo II" como bloque hecho (solo lectura), y en la barra de fichas, "Estudio → Bloque de estudio".
11. **Sin conexión:** modo avión, recargar Estudio e iniciar un foco: funciona igual.

