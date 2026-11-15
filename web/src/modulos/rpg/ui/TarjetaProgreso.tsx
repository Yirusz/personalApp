import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { hrefDe } from '../../../ui/enrutador';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { useConsulta } from '../../../ui/servicios';
import { ALMACEN_PERFIL, leerPerfil, oroDisponible, perfilInicial } from '../aplicacion/registrar-experiencia';
import { progresoPara } from '../dominio/nivel';
import { REGLAS } from '../modulo';

export function TarjetaProgreso({ ctx }: { ctx: ContextoDeModulo }) {
  const consulta = useConsulta(ctx.almacen, [ALMACEN_PERFIL], leerPerfil);
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  return <ResumenDeProgreso ctx={ctx} perfil={consulta.datos} conEnlace />;
}

export function ResumenDeProgreso({
  ctx,
  perfil: guardado,
  conEnlace = false,
}: {
  ctx: ContextoDeModulo;
  perfil: Awaited<ReturnType<typeof leerPerfil>>;
  conEnlace?: boolean;
}) {
  const { t } = ctx;
  const perfil = guardado ?? perfilInicial(REGLAS.atributos, '');
  const p = progresoPara(perfil.xpTotal, REGLAS.nivel);
  return (
    <article class="tarjeta" aria-labelledby="rpg-nivel">
      <h2 id="rpg-nivel" class="tarjeta__titulo">
        {t('rpg.nivel', { nivel: p.nivel })}
      </h2>
      <div
        class="barra-progreso"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={p.xpDelTramo}
        aria-valuenow={p.xpEnNivel}
        aria-label={t('rpg.xpDelNivel', { actual: p.xpEnNivel, total: p.xpDelTramo, siguiente: p.nivel + 1 })}
      >
        <div class="barra-progreso__relleno" style={{ width: `${Math.round(p.fraccion * 100)}%` }} />
      </div>
      <p class="texto-tenue">{t('rpg.xpDelNivel', { actual: p.xpEnNivel, total: p.xpDelTramo, siguiente: p.nivel + 1 })}</p>
      <p>
        <span>{t('rpg.xpTotal', { xp: perfil.xpTotal })}</span> ·{' '}
        <span class="oro">{t('rpg.oro', { oro: oroDisponible(perfil, REGLAS) })}</span>
      </p>
      {!guardado && <p class="texto-tenue">{t('rpg.empezar')}</p>}
      {conEnlace && (
        <p>
          <a href={hrefDe('/rpg')}>{t('rpg.verProgreso')}</a>
        </p>
      )}
    </article>
  );
}
