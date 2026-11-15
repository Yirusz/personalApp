# Escenarios de calidad — Ludus

Formato de la guía §19 (fuente, estímulo, artefacto, entorno, respuesta, medida). Sin medida no es un requisito. Dispositivo de referencia "más modesto": **Galaxy A56** (Android, Chrome); como la app debe ir bien en gama media/baja, las pruebas de rendimiento se hacen además con la CPU limitada ×4 en las herramientas del navegador.

## Rendimiento (eficiencia de desempeño)

| ID | Fuente | Estímulo | Artefacto | Entorno | Respuesta | Medida | Cómo se verifica |
|---|---|---|---|---|---|---|---|
| R-1 | Usuario | Abre Ludus ya instalada | Shell + Inicio | A56 o CPU ×4, sin red | Inicio usable con datos | ≤ 1,5 s hasta el primer contenido útil (p75 de 5 aperturas) | Panel Performance / Lighthouse |
| R-2 | Usuario | Primera visita | Toda la app | 4G lenta simulada | App usable | ≤ 3 s; JS inicial < 150 KB comprimido (hoy ≈ 23 KB) | Lighthouse; salida de `npm run build` |
| R-3 | Usuario | Toca un botón o cambia de pantalla | Cualquier pantalla | A56, 1 000 entregables y 5 000 eventos | Respuesta visual | < 100 ms (INP p75) | Performance + datos sintéticos |
| R-4 | Sistema | Bus procesa 500 eventos pendientes al abrir | Bus + RPG | CPU ×4 | Todo entregado sin bloquear la UI | < 2 s; ninguna tarea larga > 200 ms | Prueba de carga + Performance |
| R-5 | Usuario | Uso diario de un semestre | IndexedDB | Cualquier dispositivo | Almacenamiento acotado | < 20 MB tras 6 meses | Diagnóstico → Uso |

## Compatibilidad

| ID | Fuente | Estímulo | Artefacto | Entorno | Respuesta | Medida | Cómo se verifica |
|---|---|---|---|---|---|---|---|
| C-1 | Usuario | Usa todas las pantallas | Toda la app | Chrome y Zen en Windows 11 y Linux; Chrome en Galaxy Tab S10 FE y Galaxy A56 | Mismas funciones y datos | 100 % de criterios de aceptación pasan en los 6 entornos | Checklist de `docs/plataformas.md` por iteración |
| C-2 | Usuario | Exporta en un dispositivo e importa en otro | Respaldo | Cualquier par de entornos de C-1 | Datos idénticos | `exportarTodo()` igual byte a byte tras importar | Prueba automática + manual |
| C-3 | Navegador | Falta una capacidad (notificaciones, vibración, persistencia, acceso a carpetas) | Adaptadores | Zen/Firefox, Chrome sin permisos | La app sigue funcionando con menos funciones | 0 errores no manejados en Diagnóstico | Diagnóstico → Capacidades y registro |
| C-4 | Usuario | Rota la tableta o cambia el tamaño de la ventana | Shell | 360 → 1920 px | Barra inferior ↔ riel lateral sin perder estado | Sin desbordes horizontales en 360, 768, 1280 px | Prueba de humo con Playwright (3 anchos) |

## Flexibilidad (adaptabilidad, instalabilidad, extensibilidad)

| ID | Fuente | Estímulo | Artefacto | Entorno | Respuesta | Medida | Cómo se verifica |
|---|---|---|---|---|---|---|---|
| F-1 | Desarrollador (yo) | Agrega un módulo nuevo | Código | Repositorio | El módulo aparece en navegación, rutas, almacenamiento y RPG | **0 archivos modificados** fuera de `src/modulos/<nuevo>/` (salvo reglas en `reglas.v1.json`) | `git diff --stat` en el PR; prueba de arquitectura |
| F-2 | Desarrollador | Cambia el valor de un evento en el RPG | `reglas.v1.json` | Repositorio | Nueva XP sin tocar módulos | 1 archivo cambiado; `npm run check` verde | PR |
| F-3 | Usuario | Instala la PWA | Manifest + SW | Chrome en Windows/Linux/Android | Queda instalada con ícono y funciona sin red | < 2 min, sin pasos fuera de `docs/plataformas.md` | Manual por plataforma |
| F-4 | Desarrollador | Corre la verificación | `npm run check` | Windows y Linux (local y CI) | Mismo resultado | Verde en ambos; < 2 min en CI | Matriz de CI |

## Fiabilidad de los datos

| ID | Fuente | Estímulo | Artefacto | Entorno | Respuesta | Medida | Cómo se verifica |
|---|---|---|---|---|---|---|---|
| D-1 | SO Android | Mata la app entre guardar un cambio y entregar su evento | Bandeja + bus | A56 | Al abrir, el evento se entrega | 0 eventos perdidos y 0 duplicados | `bus-de-eventos.test.ts` (reinicio) |
| D-2 | Código | Un caso de uso falla a mitad | Transacción | Cualquiera | Ni cambios ni eventos parciales | 0 escrituras parciales | `almacen-indexeddb.test.ts` (todo o nada) |
| D-3 | Usuario | Importa un archivo dañado o de otra versión | Respaldo | Cualquiera | Rechazo con mensaje claro; datos intactos | 100 % de los datos previos conservados | `respaldo.test.ts` |
| D-4 | Código | Un suscriptor (p. ej. RPG) tiene un error | Bus | Cualquiera | Se pausa solo ese suscriptor; el resto sigue; reanudable | 0 bloqueos globales; aviso visible en Diagnóstico | `bus-de-eventos.test.ts` |
| D-5 | Desarrollador | Publica una versión con migración nueva | Migraciones | Dispositivo con datos de la versión anterior | Migra una vez, conserva datos | 0 pérdidas; versión de esquema +1 | `almacen-indexeddb.test.ts` (reapertura) |
| D-6 | Reloj del dispositivo | Se atrasa o adelanta | UUIDv7 + bus | Cualquiera | El orden de eventos se mantiene | Ids siempre crecientes | `uuidv7.test.ts`, `respaldo.test.ts` |
| D-7 | Navegador | Borra datos por falta de espacio | IndexedDB | Navegador sin persistencia concedida | El usuario fue advertido y tiene respaldo | Aviso visible en Ajustes; recordatorio si el último respaldo tiene > 7 días (iteración 5) | Manual |
