import { definirModulo } from '../../nucleo/contrato';
import {
  ALMACEN_PERFIL,
  ALMACEN_REGISTRO,
  EVENTO_NIVEL_ALCANZADO,
  INDICE_CLAVE_UNICA,
  INDICE_TIPO_DIA,
  crearSuscripcionDeExperiencia,
} from './aplicacion/registrar-experiencia';
import { validarConfiguracion } from './dominio/reglas';
import reglasV1 from './reglas.v1.json';
import textos from './textos.es-CO.json';

/** Se valida al importar: unas reglas inválidas detienen el arranque con un mensaje claro. */
export const REGLAS = validarConfiguracion(reglasV1);

export default definirModulo({
  id: 'rpg',
  version: '0.2.0',
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
  ],
  eventos: {
    [EVENTO_NIVEL_ALCANZADO]: { version: 1, descripcion: 'El personaje subió de nivel. Datos: nivel, nivelAnterior.' },
  },
  suscripciones: (ctx) => [crearSuscripcionDeExperiencia(REGLAS, (instante) => ctx.formatos.diaLocal(instante))],
  tarjetasDeInicio: [{ orden: 0, vista: () => import('./ui/TarjetaProgreso').then((m) => m.TarjetaProgreso) }],
});
