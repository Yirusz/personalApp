/** C6 · revisión semanal: marcar la semana como planificada (una vez por semana). */
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { useConsulta } from '../../../ui/servicios';
import { REVISIONES } from '../aplicacion/comun';
import { leerRevision, planificarSemana, semanaActual } from '../aplicacion/revision-semanal';


export function BotonSemana({ ctx }: { ctx: ContextoDeModulo }) {
  const semana = semanaActual(ctx.reloj.ahora());
  const consulta = useConsulta(ctx.almacen, [REVISIONES], (tx) => leerRevision(tx, semana));
  const hecha = consulta.estado === 'listo' && consulta.datos !== undefined;
  return (
    <div class="fila cal-semana">
      <span class="texto-tenue">{ctx.t('calendario.semanaPlanificarAyuda')}</span>
      <button type="button" class="boton" disabled={hecha || consulta.estado !== 'listo'} onClick={() => void planificarSemana(ctx)}>
        {hecha ? ctx.t('calendario.semanaPlanificada') : ctx.t('calendario.semanaPlanificar')}
      </button>
    </div>
  );
}

