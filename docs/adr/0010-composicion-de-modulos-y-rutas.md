# ADR-0010: Composición de módulos y enrutamiento

Estado: aceptado · lectura de datos de otros módulos modificada por ADR-0013
Fecha: 2026-11-14

## Contexto
Requisito clave: agregar módulos nuevos **sin modificar los existentes**. La app se sirve como archivos estáticos (GitHub Pages u otro), sin servidor que reescriba rutas, y debe funcionar sin conexión.

## Opciones consideradas
- Registro manual (lista de módulos en un archivo central): cada módulo nuevo edita ese archivo.
- **Descubrimiento automático** con `import.meta.glob('./*/modulo.ts', { eager: true })`: cero ediciones.
- Rutas con History API (`/ruta`): requieren que el servidor devuelva `index.html` para cualquier ruta (en Pages, un 404.html con truco).
- **Rutas con hash** (`#/ruta`): funcionan en cualquier hosting estático, con `base: './'`, y dentro del Service Worker sin reglas extra.

## Decisión
- **Descubrimiento automático** de `src/modulos/*/modulo.ts`. El registro valida al arrancar (ids, prefijos de textos/eventos/rutas, migraciones consecutivas, rutas únicas) y la app no inicia si algo está mal, mostrando todos los problemas juntos.
- **Rutas con hash**, cada pantalla de módulo cargada de forma diferida (un trozo de JS por pantalla).
- Cada módulo aporta: rutas, entrada de navegación (con `orden`), tarjetas para Inicio, textos, migraciones, catálogo de eventos y suscripciones.
- Una prueba de arquitectura (`src/arquitectura.test.ts`) falla si un módulo importa a otro, si el dominio importa UI/infraestructura/Preact, o si el núcleo importa un módulo concreto.

## Consecuencias
- Borrar o agregar un módulo = borrar o agregar una carpeta.
- URLs con `#` (aceptable en una PWA instalada).
- La navegación inferior en móvil muestra 5 elementos; si hay más, aparece "Más".
