# Ludus

Productividad gamificada para la universidad: materias y entregas, calendario, Pomodoro y un progreso estilo RPG que premia cumplir. **Funciona sin conexión y tus datos se quedan en tu dispositivo** (exportables a JSON).

> Estado: fase 1 (fundación) — núcleo, shell, módulo de ejemplo y núcleo del RPG. Ver [`docs/plan-maestro.md`](docs/plan-maestro.md).

## Plataformas
| Sistema | Navegadores | Instalable |
|---|---|---|
| Windows 10/11 | Chrome, Edge, Zen | Chrome/Edge sí; Zen en pestaña |
| Linux | Chrome/Chromium, Zen | Chrome sí; Zen en pestaña |
| Android 10+ | Chrome | Sí |

Detalles, instalación y checklist: [`docs/plataformas.md`](docs/plataformas.md).

## Usar la app
- **Publicada:** al hacer push a `main`, el workflow `Pages` la publica en `https://yirusz.github.io/presonalApp/` (activar una vez: *Settings → Pages → Source: GitHub Actions*).
- Instalar desde el navegador ("Instalar" / "Agregar a la pantalla principal").
- En **Ajustes**: proteger los datos y exportar respaldos.

## Desarrollo

Requisitos: **Node.js 22 LTS** (ver `.nvmrc`) y Git. Los comandos son idénticos en Windows (PowerShell o cmd) y Linux:

```sh
cd web
npm ci            # instalar dependencias exactas
npm run dev       # servidor de desarrollo: http://localhost:5173 (sin Service Worker)
npm run check     # lint + tipos + pruebas (lo mismo que corre la CI)
npm run build     # build de producción en web/dist
npm run preview   # sirve web/dist en http://localhost:4173 (con Service Worker)
```

**Probar en Android:** reenvío de puertos por USB desde `chrome://inspect` (el Service Worker exige HTTPS o `localhost`). Pasos en [`docs/plataformas.md`](docs/plataformas.md#probar-en-android-durante-el-desarrollo).

No hay variables de entorno ni secretos: la app no usa servidores.

## Estructura
```
docs/             visión, story map, dominio, arquitectura, gamificación, calidad, plataformas, plan maestro, ADRs
web/              la PWA
  src/nucleo/     contrato de módulo, bus de eventos, almacenamiento, respaldo, i18n
  src/ui/         shell, componentes base, estilos (design tokens)
  src/modulos/    un módulo por carpeta (se descubren solos)
  src/sw/         plantilla del Service Worker
  public/         manifest e íconos
.github/workflows CI (Windows + Linux) y despliegue a Pages
```

## Agregar un módulo
Crear `web/src/modulos/<id>/modulo.ts` con `definirModulo({...})` (rutas, navegación, migraciones, eventos, textos). No se modifica ningún otro archivo; para que dé experiencia, agregar reglas en `web/src/modulos/rpg/reglas.v1.json`. Guía completa: [`docs/arquitectura.md`](docs/arquitectura.md#4-contrato-de-módulo).

## Contribuir
Ramas cortas sobre `main`, [Conventional Commits](https://www.conventionalcommits.org/es/), `npm run check` en verde y CHANGELOG actualizado. Decisiones nuevas → ADR en `docs/adr/`.

## Licencia
[MIT](LICENSE).
