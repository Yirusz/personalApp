# ADR-0002: Sincronización — solo local con exportar/importar en el MVP

Estado: aceptado
Fecha: 2026-11-14

## Contexto
Un solo usuario con tres dispositivos (PC Windows/Linux, tableta Galaxy Tab S10 FE y teléfono Galaxy A56). Requisitos: offline-first, datos propios y exportables, sin servicios de pago, bajo consumo. Ver guía §3.4 y §10.

## Opciones consideradas
| Opción | Pros | Contras | Licencia / recursos |
|---|---|---|---|
| **A. Solo local + exportar/importar JSON** | Lo más simple; 100 % sin conexión; cero infraestructura; ya es parte del núcleo | Pasar datos entre dispositivos es manual; el navegador puede borrar datos si falta espacio | — / 0 |
| B. Servidor propio en el PC (Javalin + SQLite) | Datos compartidos sin terceros | HTTPS local con CA de mkcert instalada en Android; PC encendido; un backend Java más que mantener | Apache-2.0 / 50–100 MB RAM |
| C. Carpeta con Syncthing (registro de operaciones por dispositivo) | P2P, sin servidor central, también serviría para Obsidian | Necesita acceso a carpetas: no existe en Firefox/Zen; en Android requiere Chrome ≥ 132 o empaquetar con Tauri. La app de Android (Syncthing-Fork) cambió de mantenedores en 2025–2026 | MPL-2.0 / bajo |
| D. Servidor en internet | Sincroniza desde cualquier lugar | Costo mensual, administración, dependencia de terceros | — / dinero |

## Decisión
**A** para el MVP. El usuario la eligió explícitamente.

Para no cerrar la puerta a C más adelante, el modelo de datos se prepara desde ya (costo casi nulo):
- Toda entidad usa UUIDv7 generado en el dispositivo (sin colisiones entre dispositivos).
- Los eventos de dominio quedan en un registro local append-only (ADR-0009), que es la base natural de un registro de operaciones por dispositivo.
- Fechas en UTC ISO 8601.

## Consecuencias
- El respaldo es responsabilidad del usuario: la app pide `navigator.storage.persist()` y muestra en Ajustes/Diagnóstico la fecha del último respaldo exportado.
- Importar **reemplaza** todos los datos del dispositivo en una sola transacción (atómica). No hay combinación de datos entre dispositivos en v1: usar un dispositivo "principal" por período.
- Deuda: si el uso real exige trabajar en dos dispositivos el mismo día, abrir un ADR para C (log de operaciones por dispositivo + combinación por campo con reloj lógico).
