/** Tarjeta de Inicio: las próximas entregas (máx. 3). */
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { ENTREGABLES, MATERIAS } from '../aplicacion/comun';
import { leerPanel } from '../aplicacion/consultas';
import { HORAS_PROXIMOS, proximosVencimientos } from '../dominio/consultas';
import { estaVencido } from '../dominio/entregable';

const MAXIMO = 3;

export function TarjetaUniversidad({ ctx }: { ctx: ContextoDeModulo }) {
  const { t, formatos } = ctx;
  const consulta = useConsulta(ctx.almacen, [MATERIAS, ENTREGABLES], leerPanel);
  const oculto = useOcultoPorDeshacer();
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;

  const { materias, entregables } = consulta.datos;
  const activas = new Map(materias.filter((m) => !m.archivada).map((m) => [m.id, m]));
  const ahora = ctx.reloj.ahora();
  const proximos = proximosVencimientos(
    entregables.filter((e) => e.id !== oculto && activas.has(e.materiaId)),
    ahora,
  );

  return (
    <article class="tarjeta" aria-labelledby="universidad-tarjeta">
      <h2 id="universidad-tarjeta" class="tarjeta__titulo">
        {t('universidad.tarjeta.titulo')}
      </h2>
      {activas.size === 0 ? (
        <p class="texto-tenue">{t('universidad.sinMaterias')}</p>
      ) : proximos.length === 0 ? (
        <p class="texto-tenue">{t('universidad.tarjeta.nada', { horas: HORAS_PROXIMOS })}</p>
      ) : (
        <ul class="lista">
          {proximos.slice(0, MAXIMO).map((e) => (
            <li key={e.id} data-color={activas.get(e.materiaId)?.color} class="fila">
              <span class="fila__titulo">
                <span class="marca-color" aria-hidden="true" />
                <a href={hrefDe(`/universidad/entregables/${e.id}`)}>{e.titulo}</a>
              </span>
              <span class={estaVencido(e, ahora) ? 'etiqueta etiqueta--alerta' : 'texto-tenue'}>
                <time dateTime={e.venceEn}>{formatos.relativo(e.venceEn, ahora)}</time>
              </span>
            </li>
          ))}
          {proximos.length > MAXIMO && <li class="texto-tenue">{t('universidad.tarjeta.mas', { n: proximos.length - MAXIMO })}</li>}
        </ul>
      )}
      <p>
        <a href={hrefDe(activas.size === 0 ? '/universidad/materias' : '/universidad')}>
          {activas.size === 0 ? t('universidad.crearMaterias') : t('universidad.tarjeta.verTodo')}
        </a>
      </p>
    </article>
  );
}
