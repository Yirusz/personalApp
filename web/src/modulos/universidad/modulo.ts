import { definirModulo } from '../../nucleo/contrato';
import { DECLARACIONES } from './aplicacion/comun';
import { MIGRACIONES } from './infraestructura/migraciones';
import textos from './textos.es-CO.json';

/**
 * Módulo Universidad (iteración 1): materias y entregables con fecha de entrega.
 * Publica eventos con `datos.agenda` para el Calendario y datos de esfuerzo para
 * el RPG; no conoce a ninguno de los dos.
 */
export default definirModulo({
  id: 'universidad',
  version: '1.0.0',
  nombre: 'universidad.nombre',
  textos,
  navegacion: {
    etiqueta: 'universidad.nombre',
    // Birrete.
    icono: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6',
    orden: 100,
    ruta: '/universidad',
  },
  rutas: [
    {
      patron: '/universidad',
      titulo: 'universidad.titulo',
      vista: () => import('./ui/VistaUniversidad').then((m) => m.VistaUniversidad),
    },
    {
      patron: '/universidad/materias',
      titulo: 'universidad.tituloMaterias',
      vista: () => import('./ui/VistaMaterias').then((m) => m.VistaMaterias),
    },
    {
      patron: '/universidad/entregables/nuevo',
      titulo: 'universidad.tituloNuevo',
      vista: () => import('./ui/VistaNuevoEntregable').then((m) => m.VistaNuevoEntregable),
    },
    {
      patron: '/universidad/entregables/:id',
      titulo: 'universidad.tituloEntregable',
      vista: () => import('./ui/VistaEntregable').then((m) => m.VistaEntregable),
    },
  ],
  migraciones: MIGRACIONES,
  eventos: DECLARACIONES,
  tarjetasDeInicio: [{ orden: 10, vista: () => import('./ui/TarjetaUniversidad').then((m) => m.TarjetaUniversidad) }],
});
