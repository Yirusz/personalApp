import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { useConsulta } from '../../../ui/servicios';
import { ALMACEN_PERFIL, ALMACEN_REGISTRO, leerPerfil, leerUltimosAsientos } from '../aplicacion/registrar-experiencia';
import { REGLAS } from '../modulo';
import { ResumenDeProgreso } from './TarjetaProgreso';

export function VistaProgreso({ ctx }: PropsDeVista) {
  const { t, formatos } = ctx;
  const consulta = useConsulta(ctx.almacen, [ALMACEN_PERFIL, ALMACEN_REGISTRO], async (tx) => ({
    perfil: await leerPerfil(tx),
    asientos: await leerUltimosAsientos(tx),
  }));

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const { perfil, asientos } = consulta.datos;

  return (
    <div class="pila">
      <ResumenDeProgreso ctx={ctx} perfil={perfil} />

      <Seccion titulo={t('rpg.atributos')}>
        <dl class="datos">
          {REGLAS.atributos.map((a) => [
            <dt key={`${a}-t`}>{t(`rpg.atributo.${a}`)}</dt>,
            <dd key={`${a}-d`}>{formatos.numero(perfil?.atributos[a] ?? 0)} XP</dd>,
          ])}
        </dl>
      </Seccion>

      <Seccion titulo={t('rpg.historial')}>
        {asientos.length === 0 ? (
          <Vacio>{t('rpg.historialVacio')}</Vacio>
        ) : (
          <ul class="lista">
            {asientos.map((a) => (
              <li key={a.id} class="lista__item">
                <strong>{t('rpg.asiento', { xp: a.xp, atributo: t(`rpg.atributo.${a.atributo}`) })}</strong>{' '}
                <span class="texto-tenue">
                  {a.tipo} · {formatos.fechaHora(a.ocurridoEn)}
                  {a.nota && ` · ${t(`rpg.nota.${a.nota}`)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
