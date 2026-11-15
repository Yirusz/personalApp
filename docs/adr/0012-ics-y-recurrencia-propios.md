# ADR-0012: Recurrencia e iCalendar (.ics) con código propio

Estado: aceptado
Fecha: 2026-11-15

## Contexto
El Calendario necesita (1) calcular ocurrencias de eventos recurrentes solo para el rango visible, en hora de Bogotá, y (2) importar y exportar .ics. Prioridades del proyecto: correctitud → local y libre → bajo consumo → simplicidad; dependencias solo si ahorran un esfuerzo considerable.

## Opciones consideradas (datos de npm verificados el 2026-11-15; tamaño minificado + gzip medido con esbuild)
| Opción | Licencia | Peso | Mantenimiento | Pros | Contras |
|---|---|---|---|---|---|
| **Código propio del subconjunto** | — | ics ≈ 4 KB, recurrencia ≈ 1,5 KB | propio | 0 dependencias; la recurrencia es dominio puro y probado; la conversión de zonas reutiliza `Intl` | ~600 líneas con pruebas; lo exótico se importa con aviso |
| ical.js 2.2.1 | MPL-2.0 | 23 KB | última versión ago. 2025 (base de Thunderbird) | RFC 5545 completo, muy probado | 4–5× más pesado; duplica la recurrencia del dominio; sin zonas incluidas |
| ts-ics 2.4.8 | MIT | 11 KB + 1 dep. | activa (nov. 2026) | Tipado; parsea, genera y expande | Duplica la recurrencia; una dependencia más |
| rrule 2.8.1 (solo recurrencia) | BSD-3 | 13 KB | sin versiones desde 2023 | Popular | Poco mantenida; problemas conocidos con zonas |

## Decisión
**Código propio**, elegido por el usuario.
- **Recurrencia** (`modulos/calendario/dominio/recurrencia.ts`): FREQ=DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY (semanal, sin ordinales), UNTIL (fecha local inclusiva), COUNT; excepciones por fecha original (cancelada = EXDATE, modificada = RECURRENCE-ID). Se expande en hora civil de la zona del usuario (la clase de las 7:00 queda a las 7:00 aunque haya horario de verano) y solo para el rango pedido. El día 31 se salta los meses que no lo tienen (RFC 5545).
- **.ics** (`modulos/calendario/infraestructura/ics.ts`, carga diferida): lee VEVENT con fecha/UTC/TZID/flotante, DTEND o DURATION, la RRULE soportada, EXDATE, RECURRENCE-ID, STATUS:CANCELLED y VALARM relativas al inicio; nombres de zona de Windows frecuentes y prefijos de Mozilla. Lo no soportado se importa con aviso (p. ej. YEARLY → solo la primera vez). Escribe hora local con TZID (+ VTIMEZONE si la zona tiene desfase fijo), UNTIL en UTC, líneas plegadas a 75 octetos y `X-LUDUS-COLOR`/`X-LUDUS-COMPROMISO` para la ida y vuelta. Se importa por UID: reimportar actualiza, no duplica.

## Consecuencias
- Cero dependencias nuevas; ~5 KB comprimidos, cargados solo donde se usan.
- Riesgo: archivos .ics de fuentes raras (BYSETPOS, YEARLY, zonas no IANA poco comunes). Mitigación: avisos claros en la vista previa. **Disparador para revisar:** si un archivo real de la universidad pierde información importante, evaluar cargar ical.js solo en la pantalla de importación.
- Todo el día se guarda como fecha civil (`AAAA-MM-DD`) sin hora ni zona; lo demás en UTC.
