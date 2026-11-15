/** Tarjeta de Inicio: lo vencido, de hoy y de esta semana (máx. 4). */
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { zonaDelUsuario } from '../aplicacion/comun';
import { ALMACENES_DEL_PANEL, leerPanel } from '../aplicacion/consultas';
import { agruparProximas } from '../dominio/consultas';
import { IndicadorDeUrgencia } from './comun';

const MAXIMO = 4;

export function TarjetaUniversidad({ ctx }: { ctx: ContextoDeModulo }) {
  const { t, formatos } = ctx;
  const consulta = useConsulta(ctx.almacen, ALMACENES_DEL_PANEL, leerPanel);
  const oculto = useOcultoPorDeshacer();
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const { materias, trabajos } = consulta.datos;
  const activas = new Map(materias.filter((m) => !m.archivada).map((m) => [m.id, m]));
  const ahora = ctx.reloj.ahora();
  const urgentes = agruparProximas(
    trabajos.filter((x) => x.id !== oculto && activas.has(x.materiaId)),
    ahora,
    zonaDelUsuario(),
  )
    .filter((g) => g.indicador !== 'despues')
    .flatMap((g) => g.trabajos);

  return (
    <article class="tarjeta" aria-labelledby="universidad-tarjeta">
      <h2 id="universidad-tarjeta" class="tarjeta__titulo">
        {t('universidad.tarjeta.titulo')}
      </h2>
      {activas.size === 0 ? (
        <p class="texto-tenue">{t('universidad.sinMaterias')}</p>
      ) : urgentes.length === 0 ? (
        <p class="texto-tenue">{t('universidad.tarjeta.nada')}</p>
      ) : (
        <ul class="lista">
          {urgentes.slice(0, MAXIMO).map((x) => (
            <li key={x.id} data-color={activas.get(x.materiaId)?.color} class="fila">
              <span class="fila__titulo">
                <span class="marca-color" aria-hidden="true" />
                <a href={hrefDe(`/universidad/trabajos/${x.id}`)}>{x.titulo}</a>
              </span>
              <span class="acciones">
                <IndicadorDeUrgencia ctx={ctx} trabajo={x} />
                <time class="texto-tenue" dateTime={x.venceEn}>
                  {formatos.relativo(x.venceEn, ahora)}
                </time>
              </span>
            </li>
          ))}
          {urgentes.length > MAXIMO && <li class="texto-tenue">{t('universidad.tarjeta.mas', { n: urgentes.length - MAXIMO })}</li>}
        </ul>
      )}
      <p>
        <a href={hrefDe(activas.size === 0 ? '/universidad/materias' : '/universidad')}>{activas.size === 0 ? t('universidad.crearMaterias') : t('universidad.tarjeta.verTodo')}</a>
      </p>
    </article>
  );
}
