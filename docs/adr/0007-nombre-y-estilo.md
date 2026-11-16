# ADR-0007: Nombre "Ludus" y estilo visual minimalista con temas intercambiables

Estado: aceptado · color de elementos de agenda ampliado por ADR-0015 (hex legible)
Fecha: 2026-11-14

## Contexto
La app necesita nombre e identidad visual. El usuario quiere empezar minimalista y poder estilizarla más adelante como pixel art 8/16 bits.

## Opciones consideradas
- Nombres: **Ludus** (latín: "juego" y "escuela" a la vez), Gesta, Senda.
- Estilos: (1) minimalista con acentos RPG, 0 KB extra; (2) pixel art 8/16 bits, fuente pixel ~20–40 KB + sprites; (3) fantasía/pergamino, texturas pesadas y menor contraste.

## Decisión
- Nombre: **Ludus** ("por ahora": cambiarlo solo toca `manifest`, `i18n` y README).
- Estilo: **(1) minimalista**, construido sobre **design tokens** en CSS custom properties (`--color-*`, `--radio-*`, `--fuente-*`, `--borde-*`, `--sombra-*`). Dos ejes independientes en `<html>`:
  - `data-esquema="claro|oscuro"` (o automático por `prefers-color-scheme`).
  - `data-estilo="minimal"` (hoy) | `"pixel"` (futuro).
- Un componente nunca usa colores ni radios literales: solo tokens. Así, el estilo pixel será **solo una hoja de tokens** (`estilo-pixel.css`: `--radio: 0`, bordes de 2 px, sombras duras, fuente pixel cargada bajo demanda, `image-rendering: pixelated`).
- Paleta base: verde (acento "progreso") sobre neutros; contraste AA verificado en ambos esquemas.

## Consecuencias
- Fuentes del sistema (`system-ui`) en el estilo minimal: cero descarga.
- La fuente pixel futura (p. ej. una con licencia OFL) solo se descarga si el usuario elige ese estilo.
