import { definirModulo } from '../../nucleo/contrato';
import { crearZona } from '../../nucleo/dominio/zona-horaria';
import { ZONA_HORARIA } from '../../nucleo/i18n/traductor';
import {
  ALMACEN_AVISOS,
  ALMACEN_CONTADORES,
  ALMACEN_DIAS,
  ALMACEN_LOGROS,
  ALMACEN_PERFIL,
  ALMACEN_RECOMPENSAS,
  ALMACEN_REGISTRO,
  ALMACEN_SEMANAS,
  DECLARACIONES,
  INDICE_CLAVE_UNICA,
  INDICE_TIPO_DIA,
} from './aplicacion/almacenes';
import { crearSuscripcionDeExperiencia } from './aplicacion/registrar-experiencia';
import { iniciarTareasDelRpg } from './aplicacion/tareas';
import { REGLAS_DEL_RPG } from './dominio/configuracion-activa';
import textos from './textos.es-CO.json';

/** Se valida al importar: unas reglas inválidas detienen el arranque con un mensaje claro. */
export const REGLAS = REGLAS_DEL_RPG;

/**
 * Módulo Progreso (RPG, iteración 6): libro de experiencia con tramos y racha semanal,
 * logros y niveles de atributo definidos en configuración, recompensas propias con oro
 * y avisos. Escucha todos los eventos; nadie lo importa.
 */
export default definirModulo({
  id: 'rpg',
  version: '0.3.0',
  nombre: 'rpg.nombre',
  textos,
  navegacion: {
    etiqueta: 'rpg.nombre',
    icono: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z',
    orden: 500,
    ruta: '/rpg',
  },
  rutas: [
    {
      patron: '/rpg',
      titulo: 'rpg.titulo',
      vista: () => import('./ui/VistaProgreso').then((m) => m.VistaProgreso),
    },
  ],
  migraciones: [
    {
      version: 1,
      descripcion: 'Libro de experiencia y perfil del personaje',
      aplicar(ctx) {
        ctx.crearAlmacen(ALMACEN_REGISTRO);
        ctx.crearIndice(ALMACEN_REGISTRO, INDICE_TIPO_DIA, ['tipo', 'dia']);
        ctx.crearAlmacen(ALMACEN_PERFIL);
      },
    },
    {
      version: 2,
      descripcion: 'Índice por clave única para la regla unaVezPor (un premio por entidad)',
      aplicar(ctx) {
        ctx.crearIndice(ALMACEN_REGISTRO, INDICE_CLAVE_UNICA, 'claveUnica');
      },
    },
    {
      version: 3,
      descripcion: 'Contadores por día, semanas de racha, contadores y logros, recompensas y avisos (iteración 6). Los contadores se rellenan desde el libro al primer evento.',
      aplicar(ctx) {
        ctx.crearAlmacen(ALMACEN_DIAS, { clave: 'dia' });
        ctx.crearAlmacen(ALMACEN_SEMANAS, { clave: 'lunes' });
        ctx.crearAlmacen(ALMACEN_CONTADORES, { clave: 'clave' });
        ctx.crearAlmacen(ALMACEN_LOGROS);
        ctx.crearAlmacen(ALMACEN_RECOMPENSAS);
        ctx.crearAlmacen(ALMACEN_AVISOS);
      },
    },
  ],
  eventos: DECLARACIONES,
  suscripciones: () => [crearSuscripcionDeExperiencia(REGLAS_DEL_RPG, crearZona(ZONA_HORARIA))],
  alIniciar: iniciarTareasDelRpg,
  tarjetasDeInicio: [{ orden: 0, vista: () => import('./ui/TarjetaProgreso').then((m) => m.TarjetaProgreso) }],
});
