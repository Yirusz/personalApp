import { definirModulo } from '../../nucleo/contrato';
import { DECLARACIONES } from './aplicacion/comun';
import { crearProveedores } from './aplicacion/proveedores';
import { MIGRACIONES } from './infraestructura/migraciones';
import textos from './textos.es-CO.json';

/**
 * Módulo Universidad: materias y trabajos con fecha de entrega, estados, nota y
 * subtareas. Publica eventos para el RPG y ofrece por consulta (ADR-0013) una
 * fuente de calendario y referencias de materias/trabajos; no conoce a nadie.
 */
export default definirModulo({
  id: 'universidad',
  version: '2.0.0',
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
      patron: '/universidad/trabajos/nuevo',
      titulo: 'universidad.tituloNuevo',
      vista: () => import('./ui/VistaNuevoTrabajo').then((m) => m.VistaNuevoTrabajo),
    },
    {
      patron: '/universidad/trabajos/:id',
      titulo: 'universidad.tituloTrabajo',
      vista: () => import('./ui/VistaTrabajo').then((m) => m.VistaTrabajo),
    },
  ],
  migraciones: MIGRACIONES,
  eventos: DECLARACIONES,
  proveedores: crearProveedores,
  tarjetasDeInicio: [{ orden: 10, vista: () => import('./ui/TarjetaUniversidad').then((m) => m.TarjetaUniversidad) }],
});
