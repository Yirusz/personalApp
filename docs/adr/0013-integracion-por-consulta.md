# ADR-0013: Integración entre módulos por consulta (proveedores registrados)

Estado: aceptado (elegido por el usuario en la iteración 3)
Fecha: 2026-11-15
Modifica: ADR-0009 y ADR-0010 en la parte de "datos que otro módulo muestra" (los eventos de dominio siguen igual para el RPG).

## Contexto
La revisión de Universidad pide: (1) registrar una **fuente de calendario** con las fechas de entrega y (2) registrar un **proveedor de referencias** de materias y trabajos para que Estudio y Notas puedan vincularlos, todo sin acoplar módulos.

Hasta la iteración 2, el Calendario copiaba lo de otros módulos proyectando eventos con `datos.agenda`. Funciona para mostrar fechas, pero:
- Cada módulo consumidor (Estudio, Notas…) tendría que mantener su propia copia de materias y trabajos, y reconstruirla si cambia el formato.
- Los datos que ya no viajan en eventos (color de la materia editado, estado "calificado") quedan desactualizados en la copia.

## Opciones consideradas
1. **Proveedores consultables registrados en el núcleo.** Un módulo declara en su definición `proveedores(ctx)` → `{ fuentesDeCalendario?, referencias? }`. El núcleo los expone a todos como `ctx.integraciones` (`fuentesDeCalendario()`, `tiposDeReferencia()`, `buscarReferencias(consulta)`). El proveedor lee **solo su propio almacén** y devuelve tipos del lenguaje publicado (`ElementoDeAgenda`, `ReferenciaDeEntidad`). Coste: ~150 líneas en el núcleo, cero dependencias.
2. **Seguir con proyecciones por eventos** (copias locales en cada consumidor): sin consultas cruzadas, pero N copias que mantener y migrar.
3. **Consultar directamente el almacén de otro módulo:** rompe el aislamiento de ADR-0009 (prohibido).

## Decisión
Opción 1.
- El contrato del núcleo (`nucleo/contrato.ts`) define `FuenteDeCalendario {id, nombre (clave i18n), elementos(rango), alCambiar}` y `ProveedorDeReferencias {tipos, buscar(consulta), alCambiar?}`.
- `crearIntegraciones` crea cada proveedor **una vez, perezosamente**, con el contexto del módulo dueño; un proveedor que lanza al crearse se anota en Diagnóstico y se ignora.
- Las consultas son **tolerantes a fallos**: el Calendario consulta cada fuente con `Promise.allSettled` y muestra lo demás con un aviso; `buscarReferencias` devuelve `{referencias, fallos}`.
- El Calendario ignora la copia por eventos (`calendario.agenda`) de los módulos que ya ofrecen una fuente, para no duplicar. La proyección por `datos.agenda` se mantiene para módulos que solo publican eventos (OCP) y para el historial.
- Los eventos de dominio siguen siendo el canal hacia el RPG: "consulta para leer, eventos para reaccionar".

## Consecuencias
- Universidad v2 no publica `datos.agenda`; el calendario siempre muestra el estado y el color actuales.
- Estudio y Notas podrán vincular materias o trabajos con `ctx.integraciones.buscarReferencias({ tipo: 'universidad.materia', texto })` sin importar código de Universidad (prueba punta a punta incluida).
- Un consumidor no puede asumir que una referencia sigue existiendo: guarda `{tipo, id}` y resuelve con `ids` al mostrar (`activa: false` si está archivada; ausente si se borró).
- Deuda: la consulta del calendario lee el rango visible cada vez (índice `por_vencimiento`, barato con cientos de trabajos); si una fuente llegara a ser lenta, cachear por rango.
