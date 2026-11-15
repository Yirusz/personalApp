import { definirModulo } from '../../nucleo/contrato';
import { DECLARACIONES } from './aplicacion/comun';
import { crearSuscripcionDeAgenda } from './aplicacion/proyeccion';
import { iniciarRecordatorios } from './aplicacion/recordatorios';
import { MIGRACIONES } from './infraestructura/migraciones';
import textos from './textos.es-CO.json';

/**
 * Módulo Calendario (iteración 2): eventos propios con recurrencia y
 * recordatorios, vistas agenda/día/semana/mes, elementos de otros módulos
 * (vía `datos.agenda`, sin conocerlos) e importación/exportación .ics.
 */
export default definirModulo({
  id: 'calendario',
  version: '1.0.0',
  nombre: 'calendario.nombre',
  textos,
  navegacion: {
    etiqueta: 'calendario.nombre',
    icono: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h2M14 12h2M8 16h2',
    orden: 90,
    ruta: '/calendario',
  },
  rutas: [
    { patron: '/calendario', titulo: 'calendario.titulo', vista: () => import('./ui/VistaCalendario').then((m) => m.VistaCalendario) },
    { patron: '/calendario/ver/:vista/:fecha', titulo: 'calendario.titulo', vista: () => import('./ui/VistaCalendario').then((m) => m.VistaCalendario) },
    { patron: '/calendario/nuevo', titulo: 'calendario.tituloNuevo', vista: () => import('./ui/VistaFormularioEvento').then((m) => m.VistaNuevoEvento) },
    { patron: '/calendario/nuevo/:inicio', titulo: 'calendario.tituloNuevo', vista: () => import('./ui/VistaFormularioEvento').then((m) => m.VistaNuevoEvento) },
    { patron: '/calendario/eventos/:id', titulo: 'calendario.tituloEvento', vista: () => import('./ui/VistaFormularioEvento').then((m) => m.VistaEditarEvento) },
    { patron: '/calendario/eventos/:id/:ocurrencia', titulo: 'calendario.tituloOcurrencia', vista: () => import('./ui/VistaOcurrencia').then((m) => m.VistaOcurrencia) },
    { patron: '/calendario/ics', titulo: 'calendario.tituloIcs', vista: () => import('./ui/VistaIcs').then((m) => m.VistaIcs) },
  ],
  migraciones: MIGRACIONES,
  eventos: DECLARACIONES,
  suscripciones: (ctx) => [crearSuscripcionDeAgenda(ctx.diagnostico)],
  tarjetasDeInicio: [{ orden: 5, vista: () => import('./ui/TarjetaCalendario').then((m) => m.TarjetaCalendario) }],
  alIniciar: iniciarRecordatorios,
});
