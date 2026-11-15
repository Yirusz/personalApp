/** Historia 4: "Próximas entregas" (vencido / hoy / esta semana / más adelante) y lista filtrable por materia y estado. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { zonaDelUsuario } from '../aplicacion/comun';
import { ALMACENES_DEL_PANEL, leerPanel } from '../aplicacion/consultas';
import { agruparProximas, FILTRO_INICIAL, FILTROS_DE_ESTADO, filtrarTrabajos, type FiltroDeEstado, type FiltroDeTrabajos } from '../dominio/consultas';
import { guardarFiltro, leerFiltro } from '../infraestructura/preferencias';
import { Campo, idDeControl, ItemTrabajo, LineaDeAviso, type Aviso } from './comun';

export function VistaUniversidad({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const consulta = useConsulta(ctx.almacen, ALMACENES_DEL_PANEL, leerPanel);
  const oculto = useOcultoPorDeshacer();
  const [filtro, setFiltro] = useState<FiltroDeTrabajos>(leerFiltro);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  useEffect(() => guardarFiltro(filtro), [filtro]);

  const panel = consulta.estado === 'listo' ? consulta.datos : null;
  const d = useMemo(() => {
    if (!panel) return null;
    const activas = panel.materias.filter((m) => !m.archivada);
    const ids = new Set(activas.map((m) => m.id));
    const porId = new Map(panel.materias.map((m) => [m.id, m]));
    // Un filtro guardado de una materia que ya no está activa se ignora.
    const efectivo = filtro.materiaId && !ids.has(filtro.materiaId) ? { ...filtro, materiaId: null } : filtro;
    const visibles = filtrarTrabajos(
      panel.trabajos.filter((x) => x.id !== oculto),
      efectivo,
      ids,
    );
    return { activas, porId, efectivo, hayTrabajos: panel.trabajos.some((x) => ids.has(x.materiaId)), visibles, grupos: efectivo.estado === 'activos' ? agruparProximas(visibles, ctx.reloj.ahora(), zonaDelUsuario()) : null };
  }, [panel, filtro, oculto]);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const x = d!;

  if (x.activas.length === 0) {
    return (
      <div class="pila">
        <Vacio>{t('universidad.sinMaterias')}</Vacio>
        <a class="boton boton--primario" href={hrefDe('/universidad/materias')}>
          {t('universidad.crearMaterias')}
        </a>
      </div>
    );
  }

  const filtrado = x.efectivo.materiaId !== null || x.efectivo.estado !== FILTRO_INICIAL.estado;
  const item = (tr: (typeof x.visibles)[number]) => <ItemTrabajo key={tr.id} ctx={ctx} trabajo={tr} materia={x.porId.get(tr.materiaId)} alCambiar={setAviso} />;

  return (
    <div class="pila">
      <div class="acciones">
        <a class="boton boton--primario" href={hrefDe('/universidad/trabajos/nuevo')}>
          + {t('universidad.registrarTrabajo')}
        </a>
        <a class="boton" href={hrefDe('/universidad/materias')}>
          {t('universidad.verMaterias')}
        </a>
      </div>

      <div class="filtros">
        <Campo campo="filtro-materia" etiqueta={t('universidad.filtroMateria')}>
          <select id={idDeControl('filtro-materia')} value={x.efectivo.materiaId ?? ''} onChange={(e) => setFiltro({ ...filtro, materiaId: (e.currentTarget as HTMLSelectElement).value || null })}>
            <option value="">{t('universidad.filtroTodas')}</option>
            {x.activas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.periodo})
              </option>
            ))}
          </select>
        </Campo>
        <Campo campo="filtro-estado" etiqueta={t('universidad.filtroEstado')}>
          <select id={idDeControl('filtro-estado')} value={x.efectivo.estado} onChange={(e) => setFiltro({ ...filtro, estado: (e.currentTarget as HTMLSelectElement).value as FiltroDeEstado })}>
            {FILTROS_DE_ESTADO.map((s) => (
              <option key={s} value={s}>
                {t(`universidad.filtro.${s}`)}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <LineaDeAviso aviso={aviso} />

      {x.grupos ? (
        <Seccion titulo={t('universidad.proximas')}>
          {x.grupos.length === 0 ? (
            <div class="pila">
              <Vacio>{filtrado ? t('universidad.listaVaciaFiltro') : t('universidad.proximasVacio')}</Vacio>
              {!x.hayTrabajos && (
                <a class="boton boton--primario" href={hrefDe('/universidad/trabajos/nuevo')}>
                  {t('universidad.registrarTrabajo')}
                </a>
              )}
            </div>
          ) : (
            x.grupos.map((g) => (
              <section key={g.indicador} class="pila" aria-labelledby={`universidad-grupo-${g.indicador}`}>
                <h3 id={`universidad-grupo-${g.indicador}`} class={g.indicador === 'vencido' ? 'universidad-grupo universidad-grupo--vencido' : 'universidad-grupo'}>
                  {t(`universidad.indicador.${g.indicador}`)} ({g.trabajos.length})
                </h3>
                <ul class="lista">{g.trabajos.map(item)}</ul>
              </section>
            ))
          )}
        </Seccion>
      ) : (
        <Seccion titulo={t('universidad.lista')}>
          {x.visibles.length === 0 ? (
            <div class="pila">
              <Vacio>{t('universidad.listaVaciaFiltro')}</Vacio>
              <button type="button" class="boton" onClick={() => setFiltro(FILTRO_INICIAL)}>
                {t('universidad.quitarFiltro')}
              </button>
            </div>
          ) : (
            <ul class="lista">{x.visibles.map(item)}</ul>
          )}
        </Seccion>
      )}
    </div>
  );
}
