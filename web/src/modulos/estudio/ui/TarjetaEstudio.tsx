/** Tarjeta de Inicio: la fase en curso (con el tiempo que queda) o lo estudiado hoy. */
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { zonaDelUsuario } from '../aplicacion/comun';
import { ALMACENES_DE_ESTUDIO, leerPantalla } from '../aplicacion/consultas';
import { textoRestante } from '../aplicacion/temporizador';
import { estaPausada, restanteMs } from '../dominio/sesion';
import { textoDeMinutos, useTic } from './comun';

export function TarjetaEstudio({ ctx }: { ctx: ContextoDeModulo }) {
  const { t } = ctx;
  const hoy = zonaDelUsuario().aCivil(ctx.reloj.ahora().getTime()).fecha;
  const consulta = useConsulta(ctx.almacen, ALMACENES_DE_ESTUDIO, (tx) => leerPantalla(tx, hoy));
  const activa = consulta.estado === 'listo' ? consulta.datos.activa : null;
  const ahora = useTic(ctx, !!activa && !estaPausada(activa));
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const fase = activa ? t(`estudio.fase.${activa.fase}`) : '';
  return (
    <article class="tarjeta" aria-labelledby="estudio-tarjeta">
      <h2 id="estudio-tarjeta" class="tarjeta__titulo">
        {t('estudio.tarjeta.titulo')}
      </h2>
      <p class="est-tarjeta">
        {activa
          ? t(estaPausada(activa) ? 'estudio.tarjeta.enPausa' : 'estudio.tarjeta.enCurso', { fase, tiempo: textoRestante(restanteMs(activa, ahora)) })
          : t('estudio.tarjeta.hoy', { tiempo: textoDeMinutos(t, consulta.datos.resumen.hoy.minutos) })}
      </p>
      <p>
        <a href={hrefDe('/estudio')}>{t('estudio.tarjeta.ir')}</a>
      </p>
    </article>
  );
}
