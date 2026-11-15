/** Tarjeta de Inicio: recordatorios pendientes (CA8, "al abrir"), lo de hoy y la revisión semanal (C6). */
import { useMemo } from 'preact/hooks';
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { AVISOS, EVENTOS, zonaDelUsuario } from '../aplicacion/comun';
import { descartarAvisos, leerBandeja } from '../aplicacion/recordatorios';
import { rangoDeDias } from '../dominio/distribucion';
import { AvisoDeFuentes, FilaDeElemento, hoyCivil, rutaDeVista, useVisibles } from './comun';
import { BotonSemana } from './BotonSemana';

const MAXIMO = 5;

export function TarjetaCalendario({ ctx }: { ctx: ContextoDeModulo }) {
  const { t } = ctx;
  const hoy = hoyCivil(ctx);
  const rango = useMemo(() => rangoDeDias(hoy, 1, zonaDelUsuario()), [hoy]);
  const estado = useVisibles(ctx, rango);
  const ahoraMs = ctx.reloj.ahora().getTime();
  const bandeja = useConsulta(ctx.almacen, [EVENTOS, AVISOS], (tx) => leerBandeja(tx, ahoraMs));

  return (
    <article class="tarjeta pila" aria-labelledby="calendario-tarjeta">
      {bandeja.estado === 'listo' && bandeja.datos.length > 0 && (
        <section class="pila cal-bandeja" aria-labelledby="calendario-bandeja" role="region">
          <h2 id="calendario-bandeja" class="tarjeta__titulo">
            🔔 {t('calendario.recordatorios.titulo')}
          </h2>
          <ul class="cal-lista">
            {bandeja.datos.map((a) => (
              <li key={a.clave} class="fila">
                <span>
                  <a href={hrefDe(`/calendario/eventos/${a.eventoId}/${a.ocurrencia}`)}>{a.titulo}</a>{' '}
                  <span class="texto-tenue">
                    {a.inicioMs > ahoraMs ? t('calendario.recordatorios.empieza', { relativo: ctx.formatos.relativo(new Date(a.inicioMs), new Date(ahoraMs)) }) : t('calendario.recordatorios.enCurso')}
                  </span>
                </span>
                <button type="button" class="boton" aria-label={t('calendario.recordatorios.descartarTitulo', { titulo: a.titulo })} onClick={() => void descartarAvisos(ctx, [a])}>
                  {t('calendario.recordatorios.descartar')}
                </button>
              </li>
            ))}
          </ul>
          {bandeja.datos.length > 1 && (
            <button type="button" class="boton" onClick={() => void descartarAvisos(ctx, bandeja.datos)}>
              {t('calendario.recordatorios.descartarTodos')}
            </button>
          )}
        </section>
      )}

      <h2 id="calendario-tarjeta" class="tarjeta__titulo">
        {t('calendario.tarjeta.titulo')}
      </h2>
      {estado.estado === 'cargando' ? (
        <Cargando />
      ) : estado.estado === 'error' ? (
        <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
      ) : (
        <>
          <AvisoDeFuentes ctx={ctx} visibles={estado.visibles} reintentar={estado.reintentar} />
          {estado.visibles.elementos.filter((x) => x.todoElDia || x.finMs > ahoraMs || x.puntual).length === 0 ? (
            <p class="texto-tenue">{t('calendario.tarjeta.nada')}</p>
          ) : (
            <ul class="cal-lista">
              {estado.visibles.elementos
                .filter((x) => x.todoElDia || x.finMs > ahoraMs || x.puntual)
                .slice(0, MAXIMO)
                .map((x) => (
                  <FilaDeElemento key={x.id} ctx={ctx} x={x} />
                ))}
            </ul>
          )}
        </>
      )}
      <BotonSemana ctx={ctx} />
      <p>
        <a href={hrefDe(rutaDeVista('agenda', hoy))}>{t('calendario.tarjeta.verCalendario')}</a>
      </p>
    </article>
  );
}
