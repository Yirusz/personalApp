# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado
- Fase 1: visión, story map, modelo de dominio, arquitectura (C4), reglas de gamificación v1, ADRs 0001–0010, escenarios de calidad y plan maestro.
- Fundación de la PWA `web/`: shell con navegación adaptativa, tema claro/oscuro/sistema, textos en es-CO, manifest y Service Worker escrito a mano.
- Núcleo: registro de módulos con descubrimiento automático, bus de eventos con bandeja de salida (outbox) persistente y cursores por suscriptor, IndexedDB con migraciones por módulo, UUIDv7, `Reloj` inyectable, exportar/importar JSON y pantalla de diagnóstico.
- Módulo `ejemplo` que recorre el contrato de punta a punta y núcleo del módulo `rpg` que registra la experiencia según `reglas.v1.json`.
- `npm run check` (lint, tipos y pruebas) y CI con matriz Windows + Linux.
