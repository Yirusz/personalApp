import { definirModulo } from '../../nucleo/contrato';
import { EVENTO_REGISTRO_CREADO } from './aplicacion/registrar';
import { MIGRACIONES } from './infraestructura/migraciones';
import textos from './textos.es-CO.json';

export default definirModulo({
  id: 'ejemplo',
  version: '0.1.0',
  nombre: 'ejemplo.nombre',
  textos,
  navegacion: {
    etiqueta: 'ejemplo.nombre',
    icono: 'M4 4h16v16H4zM8 12l3 3 5-6',
    orden: 900,
    ruta: '/ejemplo',
  },
  rutas: [
    {
      patron: '/ejemplo',
      titulo: 'ejemplo.titulo',
      vista: () => import('./ui/VistaEjemplo').then((m) => m.VistaEjemplo),
    },
  ],
  migraciones: MIGRACIONES,
  eventos: {
    [EVENTO_REGISTRO_CREADO]: { version: 1, descripcion: 'Se guardó un registro de ejemplo. Datos: registroId, longitud.' },
  },
});
