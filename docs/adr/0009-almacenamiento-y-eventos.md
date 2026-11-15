# ADR-0009: Almacenamiento local y eventos de dominio confiables

Estado: aceptado
Fecha: 2026-11-14

## Contexto
- Todo vive en el dispositivo (ADR-0002). La correctitud es la prioridad #1.
- Cada módulo necesita su propio almacenamiento con migraciones propias, sin tocar los demás.
- Los módulos se comunican solo por eventos; el RPG debe recibir **cada** evento **exactamente una vez**, aunque la app se cierre a mitad de camino (Android mata pestañas en segundo plano).

## Opciones consideradas
1. **Una base IndexedDB, almacenes prefijados por módulo, bandeja de eventos persistente + cursor por suscripción.**
2. Una base IndexedDB por módulo: aislamiento total, pero imposible guardar estado y evento en la misma transacción.
3. SQLite WASM sobre OPFS: SQL y transacciones, pero ~1 MB extra y sin necesidad real todavía (guía §3.3).
4. Bus solo en memoria (publicar tras guardar): si la app se cierra entre ambos pasos, el evento se pierde.

## Decisión
Opción 1:
- **Base única `ludus`.** Cada módulo ve solo `<modulo>_<almacén>` mediante `paraModulo(id)`; el núcleo usa `nucleo_*`.
- **Migraciones por módulo** (`version` 1, 2, 3…). `nucleo_meta` guarda la versión aplicada de cada módulo. Al abrir, si hay pendientes, se sube en 1 la versión de la base y se aplican en `onupgradeneeded`. Una migración publicada nunca se edita. Datos de una versión más nueva de la app → la app se niega a abrir (sin degradar datos).
- **Bandeja de salida (outbox):** `tx.publicar()` escribe el evento en `nucleo_eventos` dentro de la misma transacción que el cambio de estado (todo o nada).
- **Entrega:** por cada suscripción, el bus lee eventos con id > cursor y llama a `manejar` en **la misma transacción** que avanza el cursor en `nucleo_cursores` y escribe el estado del suscriptor → exactamente una vez. Si falla, se deshace, la suscripción queda en pausa (visible y reanudable en Diagnóstico) y las demás siguen.
- **Orden:** ids UUIDv7 monótonos. Toda transacción de escritura incluye `nucleo_eventos`, lo que hace que IndexedDB las serialice: el orden de los ids coincide con el orden de confirmación (sin huecos que el cursor pudiera saltarse). Al abrir, el generador se adelanta al último id guardado (reloj del dispositivo atrasado).
- **Suscripción nueva** procesa el historial completo por defecto (útil para recalcular), u opta por `historial: 'desdeAhora'`.

## Consecuencias
- Simple y sin dependencias; probado con fake-indexeddb (reinicios, fallos, cadenas de eventos).
- Las escrituras se serializan: irrelevante para un solo usuario.
- Dentro de una transacción solo se puede esperar a operaciones de IndexedDB (documentado en el contrato).
- Deuda: `nucleo_eventos` crece sin límite (~KB por día); compactar cuando todas las suscripciones hayan pasado un evento y ya no haga falta recalcular. Importar respaldos de **otra** versión de esquema no está soportado en v1.
