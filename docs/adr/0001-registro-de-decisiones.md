# ADR-0001: Registrar las decisiones de arquitectura como ADRs en el repositorio

Estado: aceptado
Fecha: 2026-11-14

## Contexto
Ludus se construye por fases y por sesiones independientes (cada sesión empieza sin memoria de la anterior). Las decisiones y su porqué tienen que sobrevivir en el repositorio, junto al código. La guía del proyecto (`claude/guia-construccion.md`) fija decisiones por defecto y exige un ADR para cualquier desviación.

## Opciones consideradas
1. **ADRs en Markdown dentro de `docs/adr/`**: versionados con el código, revisables en cada PR, sin herramientas.
2. Wiki del alojamiento (GitHub/Forgejo): fuera del repo, se desincroniza del código y no viaja en un `git clone`.
3. Solo comentarios en el código: no registran las opciones descartadas.

## Decisión
Opción 1. Un archivo por decisión, `NNNN-titulo-con-guiones.md`, con la plantilla de la guía §19 (Contexto, Opciones, Decisión, Consecuencias). Un ADR aceptado no se edita: se reemplaza con uno nuevo que lo marque como `reemplazado por ADR-00XX`.

## Consecuencias
- Cualquier sesión nueva lee `docs/plan-maestro.md` y `docs/adr/` y continúa sin este chat.
- Cambiar una decisión cuesta un archivo nuevo; es deliberado.

## Índice
| ADR | Decisión |
|---|---|
| 0001 | Registrar decisiones como ADRs |
| 0002 | Sincronización: solo local con exportar/importar (MVP) |
| 0003 | Obsidian fuera del MVP; notas en Markdown con frontmatter |
| 0004 | Cliente: PWA pura |
| 0005 | Diseño de la gamificación v1 (esfuerzo por tipo según 0014) |
| 0006 | Alcance del MVP (alcance del Calendario modificado por 0011) |
| 0007 | Nombre "Ludus" y estilo visual minimalista con temas intercambiables |
| 0008 | Stack del frontend |
| 0009 | Almacenamiento local y eventos de dominio confiables (lectura entre módulos según 0013) |
| 0010 | Composición de módulos y enrutamiento |
| 0011 | El Calendario completo entra al MVP (modifica 0006) |
| 0012 | Recurrencia e iCalendar (.ics) con código propio |
| 0013 | Integración entre módulos por consulta: proveedores registrados (modifica 0009/0010) |
| 0014 | XP por tipo de trabajo; notas y pesos como enteros (modifica 0005) |
| 0015 | Fichas del calendario, color libre (#rrggbb legible) y vínculos entre módulos (amplía 0013; color: modifica 0007) |
| 0016 | `ocurridoEn` explícito al publicar (cuándo pasó de verdad; nunca futuro). Precisa 0009 |
