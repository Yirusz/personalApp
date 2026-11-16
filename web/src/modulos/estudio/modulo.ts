import { definirModulo } from '../../nucleo/contrato';
import { DECLARACIONES } from './aplicacion/comun';
import { crearProveedores } from './aplicacion/proveedores';
import { iniciarTemporizador } from './aplicacion/temporizador';
import { MIGRACIONES } from './infraestructura/migraciones';
import textos from './textos.es-CO.json';

/**
 * Módulo Estudio (iteración 5): Pomodoro con fases, resistente a congelamiento (el tiempo
 * sale del Reloj), aviso con la app abierta, estadísticas de hoy y la semana, vínculo
 * opcional con una materia o un trabajo (por consulta) y sesiones en el calendario.
 */
export default definirModulo({
  id: 'estudio',
  version: '1.0.0',
  nombre: 'estudio.nombre',
  textos,
  navegacion: {
    etiqueta: 'estudio.nombre',
    icono: 'M12 8v4l2.5 2.5M9 2h6M12 2v2M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    orden: 95,
    ruta: '/estudio',
  },
  rutas: [
    { patron: '/estudio', titulo: 'estudio.titulo', vista: () => import('./ui/VistaEstudio').then((m) => m.VistaEstudio) },
    { patron: '/estudio/ajustes', titulo: 'estudio.tituloAjustes', vista: () => import('./ui/VistaAjustes').then((m) => m.VistaAjustes) },
  ],
  migraciones: MIGRACIONES,
  eventos: DECLARACIONES,
  tarjetasDeInicio: [{ orden: 3, vista: () => import('./ui/TarjetaEstudio').then((m) => m.TarjetaEstudio) }],
  alIniciar: iniciarTemporizador,
  proveedores: crearProveedores,
});
