# ADR-0003: Integración con Obsidian fuera del MVP; notas compatibles desde el diseño

Estado: aceptado
Fecha: 2026-11-14

## Contexto
El usuario usa Obsidian. Integrarse implica leer/escribir archivos `.md` de una carpeta (la bóveda). Una PWA solo puede hacerlo con la API File System Access, disponible en Chromium de escritorio y en Chrome para Android ≥ 132, pero **no en Firefox ni en Zen** (Zen es uno de los navegadores del usuario).

## Opciones consideradas
| Opción | Pros | Contras |
|---|---|---|
| (a) Leer y escribir directamente en la bóveda | Integración total | Dos programas escribiendo los mismos archivos; riesgo de dañar notas (wikilinks, plugins, ediciones simultáneas); necesita acceso a carpetas |
| (b) Notas propias como Markdown con frontmatter YAML, intercambiadas por archivos o carpeta dedicada (`Bóveda/Ludus/`) | La app solo escribe en su carpeta; Obsidian las lee y enlaza | Igual necesita acceso a carpetas para ser automática (o export/import manual de `.md`) |
| **(c) Fuera del MVP** | Cero costo ahora | El valor llega después |

## Decisión
**(c)**, elegida por el usuario. El módulo Notas (posterior al MVP) modelará cada nota como `{ frontmatter, cuerpoMarkdown }` con campos compatibles con Obsidian (`tags`, `aliases`, `created`, `updated`, `ludus_id`), para que (b) sea solo un adaptador nuevo.

## Consecuencias
- Cuando llegue (b), el camino universal (todos los navegadores) es exportar/importar un `.zip`/carpeta de `.md`; la sincronización automática con carpeta queda como mejora detectada en tiempo de ejecución (`'showDirectoryPicker' in window`) o como motivo para Tauri (ADR-0004).
- (a) queda descartada por correctitud mientras no exista un mecanismo de bloqueo/merge confiable.
