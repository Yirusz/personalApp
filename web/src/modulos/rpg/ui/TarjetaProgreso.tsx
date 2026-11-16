import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { hrefDe } from '../../../ui/enrutador';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { useConsulta } from '../../../ui/servicios';
import { oroDisponible, perfilDesdeAlmacen, type Perfil } from '../aplicacion/almacenes';
import { REGLAS_DEL_RPG as REGLAS } from '../dominio/configuracion-activa';
import { progresoPara } from '../dominio/nivel';
import { multiplicadorDeRacha } from '../dominio/racha';
import { ALMACENES_DE_PROGRESO, leerPantalla } from './consultas';
import './rpg.css';

export function TarjetaProgreso({ ctx }: { ctx: ContextoDeModulo }) {
  const hoy = ctx.formatos.diaLocal(ctx.reloj.ahora().toISOString());
  const consulta = useConsulta(ctx.almacen, ALMACENES_DE_PROGRESO, (tx) => leerPantalla(tx, hoy));
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  return <ResumenDeProgreso ctx={ctx} perfil={consulta.datos.perfil} activosEstaSemana={consulta.datos.activosEstaSemana} conEnlace />;
}

export function ResumenDeProgreso({ ctx, perfil: guardado, activosEstaSemana, conEnlace = false }: { ctx: ContextoDeModulo; perfil: Perfil | undefined; activosEstaSemana: number; conEnlace?: boolean }) {
  const { t, formatos } = ctx;
  const perfil = perfilDesdeAlmacen(guardado, REGLAS, '');
  const p = progresoPara(perfil.xpTotal, REGLAS.nivel);
  const textoNivel = t('rpg.xpDelNivel', { actual: p.xpEnNivel, total: p.xpDelTramo, siguiente: p.nivel + 1 });
  const { semanas, comodines } = perfil.racha;
  const meta = REGLAS.racha.diasActivosPorSemana;
  return (
    <article class="tarjeta rpg-resumen" aria-labelledby="rpg-nivel">
      <h2 id="rpg-nivel" class="tarjeta__titulo">
        {t('rpg.nivel', { nivel: p.nivel })}
      </h2>
      <div class="barra-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={p.xpDelTramo} aria-valuenow={p.xpEnNivel} aria-label={textoNivel}>
        <div class="barra-progreso__relleno" style={{ width: `${Math.round(p.fraccion * 100)}%` }} />
      </div>
      <p class="texto-tenue">{textoNivel}</p>
      <p class="rpg-cifras">
        <span>{t('rpg.xpTotal', { xp: formatos.numero(perfil.xpTotal) })}</span>
        <span class="oro">{t('rpg.oro', { oro: formatos.numero(oroDisponible(perfil, REGLAS)) })}</span>
      </p>
      <p class="rpg-racha">
        <span aria-hidden="true">🔥</span>{' '}
        <strong>{t('rpg.racha.semanas', { n: semanas })}</strong>
        {semanas > 0 && <span class="texto-tenue"> · ×{formatos.numero(multiplicadorDeRacha(semanas, REGLAS.racha))}</span>}
        {comodines > 0 && <span class="texto-tenue"> · {t('rpg.racha.comodines', { n: comodines })}</span>}
      </p>
      <p class="texto-tenue">{t('rpg.racha.estaSemana', { activos: Math.min(activosEstaSemana, 7), meta })}</p>
      {!guardado && <p class="texto-tenue">{t('rpg.empezar')}</p>}
      {conEnlace && (
        <p>
          <a href={hrefDe('/rpg')}>{t('rpg.verProgreso')}</a>
        </p>
      )}
    </article>
  );
}
