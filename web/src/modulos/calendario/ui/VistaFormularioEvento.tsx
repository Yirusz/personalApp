/** CA1/CA5: crear un evento, o editar un evento o toda su serie (y eliminarlo con deshacer). */
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer, useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { EVENTOS } from '../aplicacion/comun';
import { crearEvento, editarEvento, eliminarEvento } from '../aplicacion/eventos';
import type { EventoDeCalendario } from '../dominio/evento';
import { borradorDesde, borradorNuevo, FormularioEvento } from './FormularioEvento';

export function VistaNuevoEvento({ ctx, params }: PropsDeVista) {
  return (
    <FormularioEvento
      ctx={ctx}
      inicial={borradorNuevo(ctx, params.inicio, params.fin)}
      modo="evento"
      textoGuardar={ctx.t('calendario.crear')}
      volverA="/calendario"
      alGuardar={async (datos) => {
        const e = await crearEvento(ctx, datos);
        const fecha = e.todoElDia ? e.inicio : ctx.formatos.diaLocal(e.inicio);
        ctx.navegar(`/calendario/ver/dia/${fecha}`);
        return ctx.t('calendario.creado');
      }}
    />
  );
}

export function VistaEditarEvento({ ctx, params }: PropsDeVista) {
  const id = params.id ?? '';
  const consulta = useConsulta(ctx.almacen, [EVENTOS], (tx) => tx.obtener<EventoDeCalendario>(EVENTOS, id));
  const oculto = useOcultoPorDeshacer();
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const e = consulta.datos;
  if (!e || oculto === id) {
    return (
      <div class="pila">
        <Vacio>{ctx.t('calendario.noExiste')}</Vacio>
        <a class="boton" href={hrefDe('/calendario')}>
          {ctx.t('calendario.volver')}
        </a>
      </div>
    );
  }
  const eliminar = () => {
    void ofrecerDeshacer({ mensaje: ctx.t('calendario.eliminado'), ocultar: e.id, confirmar: () => eliminarEvento(ctx, e.id) });
    ctx.navegar('/calendario');
  };
  return (
    <div class="pila">
      {e.recurrencia && <p class="aviso">{ctx.t('calendario.editarSerieAviso')}</p>}
      <FormularioEvento
        ctx={ctx}
        inicial={borradorDesde(ctx, e, e.todoElDia)}
        modo="evento"
        textoGuardar={ctx.t('calendario.guardar')}
        volverA="/calendario"
        alGuardar={async (datos) => {
          await editarEvento(ctx, e.id, datos);
          return ctx.t('calendario.guardado');
        }}
      />
      <button type="button" class="boton boton--peligro" onClick={eliminar}>
        {e.recurrencia ? ctx.t('calendario.eliminarSerie') : ctx.t('calendario.eliminar')}
      </button>
    </div>
  );
}
