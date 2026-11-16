# ADR-0015: Fichas del calendario, color libre y vínculos entre módulos

Estado: aceptado (opciones elegidas por el usuario en la iteración 4)
Fecha: 2026-11-15
Amplía: ADR-0013 (nuevo tipo de proveedor). Modifica: ADR-0007 solo para el color de los elementos de agenda (antes, solo tokens).

## Contexto
La revisión del Calendario pide:
- **H1:** color hex elegible por evento.
- **H8:** un sistema de *fichas* para poner y quitar rápido cosas del calendario (las clases de cada materia y, más adelante, actividades de otros módulos).
- **H9:** al crear un evento, poder usar directamente esas clases u otros elementos de los módulos.

Restricciones: el Calendario no puede conocer a Universidad (ADR-0010/0013), y los colores deben verse bien en tema claro y oscuro (ADR-0007: los componentes solo usan tokens).

## Opciones consideradas
**Color**
1. *Paleta + hex libre con contraste automático* (elegida): se guarda `#rrggbb`; al pintar se calculan dos variantes (clara y oscura) que alcanzan 3:1 contra fondo y superficie (WCAG 1.4.11) mezclando con negro o blanco, y se aplican con `light-dark()`. El texto nunca usa ese color: va sobre un tinte suave con el color de texto del tema.
2. Hex tal cual: algunos colores no se leen en tema oscuro.
3. Solo ampliar la paleta: no cumple H1.

**Fichas**
1. *Proveedor genérico de fichas en el contrato* (elegida): `Proveedores.fichas = { nombre, fichas(), alCambiar? }` y `ctx.integraciones.fichas()`. Una ficha (`FichaDeCalendario`) es una plantilla: título, detalle, color, duración, repetición (`unica` o `semanal` con N semanas) y vínculo opcional. El Calendario las lista sin saber de quién son y ofrece sus **fichas propias** por el mismo canal.
2. Que el Calendario construya fichas a partir de `buscarReferencias({ tipo: 'universidad.materia' })`: el Calendario tendría que conocer tipos de Universidad y decidir por ella la duración y la repetición.
3. Arrastrar desde una lista sin modelo: no permite quitar lo puesto ni extenderse a otros módulos.

## Decisión
- **Núcleo:** `nucleo/dominio/color.ts` (`ColorDeAgenda` = token | `#rrggbb`, `variantesLegibles`, `contraste`) y `nucleo/dominio/fichas.ts` (`FichaDeCalendario`, `Vinculo`, `normalizarFicha`: lo que llega de otro módulo se valida y lo inválido se omite e informa). `ElementoDeAgenda.color` acepta también hex. `ui/color.ts` → `atributosDeColor()`.
- **Calendario:** `EventoDeCalendario.vinculo {tipo, id}` y `ficha` (`<modulo>:<fichaId>`), ambos opcionales (los datos viejos siguen valiendo; migración v2 solo agrega el almacén `fichas`). *Poner* una ficha = crear el evento (semanal → serie `WEEKLY;BYDAY=<día>;COUNT=N`); *quitar* = eliminar el evento que creó, con deshacer. Sin XP (`FichaCreada/Editada/Eliminada` no tienen reglas).
- **Universidad:** ofrece una ficha por materia activa (clase semanal de 2 h, 16 semanas, vinculada a la materia). Es un cambio **aditivo** en su archivo de proveedores (su API pública), justificado porque solo Universidad sabe qué es "una clase" de sus materias.
- Por defecto, la ficha de una materia crea una **clase semanal** (elección del usuario); la duración y las semanas se editan después en el evento.

## Corrección 0.5.1 (pedida por el usuario)
- Las fichas viven en una **barra lateral** y se **arrastran** a la vista. Se usa Pointer Events y no la API de arrastrar de HTML, porque esta no funciona con el dedo en Android. En la barra vertical la ficha deja desplazar arriba/abajo (`touch-action: pan-y`) y arrastrar de lado la saca; en la franja del teléfono es al revés (`pan-x`). Soltar en el mes abre el día para elegir la hora.
- El color libre se elige con un **selector integrado** (HSV en el dominio, `hexDesdeHsv`/`hsvDesdeHex`), sin el `<input type="color">` nativo, que abre una ventana emergente. Para las barras rellenas, `rellenoLegible` garantiza texto con contraste ≥ 4,5:1.

## Consecuencias
- Estudio (Pomodoro) y otros módulos podrán ofrecer fichas sin tocar el Calendario.
- Un evento creado con una ficha es un evento normal: editarlo no cambia la ficha y borrar la ficha no borra lo ya puesto.
- El vínculo se resuelve al mostrar (`buscarReferencias` por id); si la entidad se borró, se ve "ya no existe".
- Deuda: el ajuste de color usa mezcla en sRGB (simple y suficiente); un hex muy saturado puede cambiar un poco de tono en tema oscuro. Exportar .ics no lleva el color (RFC 7986 `COLOR` solo admite nombres CSS).
