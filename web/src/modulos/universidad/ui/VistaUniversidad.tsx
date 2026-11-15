/** U5: próximos vencimientos arriba y lista filtrable por materia y estado. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { ENTREGABLES, MATERIAS } from '../aplicacion/comun';
import { leerPanel } from '../aplicacion/consultas';
import { FILTRO_INICIAL, FILTROS_DE_ESTADO, HORAS_PROXIMOS, filtrarEntregables, proximosVencimientos, type FiltroDeEntregables, type FiltroDeEstado } from '../dominio/consultas';
import { guardarFiltro, leerFiltro } from '../infraestructura/preferencias';
import { ItemEntregable, LineaDeAviso, type Aviso } from './comun';

export function VistaUniversidad({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const consulta = useConsulta(ctx.almacen, [MATERIAS, ENTREGABLES], leerPanel);
  const oculto = useOcultoPorDeshacer();
  const [filtro, setFiltro] = useState<FiltroDeEntregables>(leerFiltro);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const panel = consulta.estado === 'listo' ? consulta.datos : null;
  const datos = useMemo(() => {
    if (!panel) return null;
    const activas = panel.materias.filter((m) => !m.archivada);
    const idsActivas = new Set(activas.map((m) => m.id));
    const porId = new Map(panel.materias.map((m) => [m.id, m]));
    const visibles = panel.entregables.filter((e) => e.id !== oculto && idsActivas.has(e.materiaId));
    // Un filtro guardado de una materia que ya no está activa se ignora.
    const efectivo = filtro.materiaId && !idsActivas.has(filtro.materiaId) ? { ...filtro, materiaId: null } : filtro;
    return {
      activas,
      porId,
      efectivo,
      hayEntregables: visibles.length > 0,
      proximos: proximosVencimientos(visibles, ctx.reloj.ahora()),
      lista: filtrarEntregables(visibles, efectivo, idsActivas),
    };
  }, [panel, filtro, oculto]);

  useEffect(() => guardarFiltro(filtro), [filtro]);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const d = datos!;

  if (d.activas.length === 0) {
    return (
      <div class="pila">
        <Vacio>{t('universidad.sinMaterias')}</Vacio>
        <a class="boton boton--primario" href={hrefDe('/universidad/materias')}>
          {t('universidad.crearMaterias')}
        </a>
      </div>
    );
  }

  const filtrado = d.efectivo.materiaId !== null || d.efectivo.estado !== FILTRO_INICIAL.estado;

  return (
    <div class="pila">
      <div class="acciones">
        <a class="boton boton--primario" href={hrefDe('/universidad/entregables/nuevo')}>
          + {t('universidad.registrarEntregable')}
        </a>
        <a class="boton" href={hrefDe('/universidad/materias')}>
          {t('universidad.verMaterias')}
        </a>
      </div>

      <LineaDeAviso aviso={aviso} />

      {d.proximos.length > 0 && (
        <Seccion titulo={t('universidad.proximos')}>
          <p class="texto-tenue">{t('universidad.proximosAyuda', { horas: HORAS_PROXIMOS })}</p>
          <ul class="lista">
            {d.proximos.map((e) => (
              <ItemEntregable key={e.id} ctx={ctx} entregable={e} materia={d.porId.get(e.materiaId)} alCompletar={setAviso} />
            ))}
          </ul>
        </Seccion>
      )}

      <Seccion titulo={t('universidad.lista')}>
        {!d.hayEntregables ? (
          <div class="pila">
            <Vacio>{t('universidad.listaVacia')}</Vacio>
            <a class="boton boton--primario" href={hrefDe('/universidad/entregables/nuevo')}>
              {t('universidad.registrarEntregable')}
            </a>
          </div>
        ) : (
          <>
            <div class="filtros">
              <label class="campo">
                <span>{t('universidad.filtroMateria')}</span>
                <select
                  value={d.efectivo.materiaId ?? ''}
                  onChange={(e) => setFiltro({ ...filtro, materiaId: (e.currentTarget as HTMLSelectElement).value || null })}
                >
                  <option value="">{t('universidad.filtroTodas')}</option>
                  {d.activas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label class="campo">
                <span>{t('universidad.filtroEstado')}</span>
                <select
                  value={d.efectivo.estado}
                  onChange={(e) => setFiltro({ ...filtro, estado: (e.currentTarget as HTMLSelectElement).value as FiltroDeEstado })}
                >
                  {FILTROS_DE_ESTADO.map((estado) => (
                    <option key={estado} value={estado}>
                      {t(`universidad.filtro.${estado}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {d.lista.length === 0 ? (
              <div class="pila">
                <Vacio>{t('universidad.listaVaciaFiltro')}</Vacio>
                {filtrado && (
                  <button type="button" class="boton" onClick={() => setFiltro(FILTRO_INICIAL)}>
                    {t('universidad.quitarFiltro')}
                  </button>
                )}
              </div>
            ) : (
              <ul class="lista">
                {d.lista.map((e) => (
                  <ItemEntregable key={e.id} ctx={ctx} entregable={e} materia={d.porId.get(e.materiaId)} alCompletar={setAviso} />
                ))}
              </ul>
            )}
          </>
        )}
      </Seccion>
    </div>
  );
}
