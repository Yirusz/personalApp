/**
 * Una ocurrencia (CA6, CA7, CA12): detalle; editar o borrar solo esta (con
 * deshacer); ir a editar o eliminar toda la serie; marcar el bloque como cumplido.
 */
import { useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer, useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { EVENTOS, zonaDelUsuario } from '../aplicacion/comun';
import { cancelarOcurrencia, desmarcarCumplido, editarOcurrencia, eliminarEvento, marcarCumplido, restaurarOcurrencia } from '../aplicacion/eventos';
import { esClaveDeOcurrencia, HORAS_PARA_CUMPLIR, type EventoDeCalendario } from '../dominio/evento';
import { instanciar } from '../dominio/expansion';
import { aDatosDeOcurrencia, borradorDesde, FormularioEvento, textoDeRecordatorio } from './FormularioEvento';
import { atributosDeColor } from '../../../ui/color';
import { fechas, horarioDe, LineaDeAviso, LineaDeVinculo, Marcas, mensajeDeError, rutaDeVista, type Aviso } from './comun';

export function VistaOcurrencia({ ctx, params }: PropsDeVista) {
  const id = params.id ?? '';
  const clave = params.ocurrencia ?? '';
  const consulta = useConsulta(ctx.almacen, [EVENTOS], (tx) => tx.obtener<EventoDeCalendario>(EVENTOS, id));
  const oculto = useOcultoPorDeshacer();
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const e = consulta.datos;
  if (!e || oculto === id || !esClaveDeOcurrencia(e, clave, zonaDelUsuario())) {
    return (
      <div class="pila">
        <Vacio>{ctx.t('calendario.noExiste')}</Vacio>
        <a class="boton" href={hrefDe('/calendario')}>
          {ctx.t('calendario.volver')}
        </a>
      </div>
    );
  }
  return <Detalle ctx={ctx} e={e} clave={clave} />;
}

function Detalle({ ctx, e, clave }: { ctx: ContextoDeModulo; e: EventoDeCalendario; clave: string }) {
  const { t } = ctx;
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const o = instanciar(e, clave, zonaDelUsuario());
  const excepcion = e.excepciones[clave];
  const ahora = ctx.reloj.ahora().getTime();
  const volver = rutaDeVista('dia', o?.fechaInicio ?? clave);

  const ejecutar = async (accion: () => Promise<unknown>, exito?: string) => {
    setOcupado(true);
    setAviso(null);
    try {
      await accion();
      if (exito) setAviso({ ok: true, texto: exito });
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    } finally {
      setOcupado(false);
    }
  };

  const borrarSoloEsta = () =>
    ejecutar(async () => {
      const anterior = await cancelarOcurrencia(ctx, e.id, clave);
      await ofrecerDeshacer({ mensaje: t('calendario.ocurrencia.borrada'), deshacer: () => restaurarOcurrencia(ctx, e.id, clave, anterior) });
    });

  const eliminarTodo = () => {
    void ofrecerDeshacer({ mensaje: t('calendario.eliminado'), ocultar: e.id, confirmar: () => eliminarEvento(ctx, e.id) });
    ctx.navegar(volver);
  };

  if (!o) {
    // Ocurrencia borrada: se puede restaurar.
    return (
      <div class="pila">
        <p class="aviso">{t('calendario.ocurrencia.cancelada')}</p>
        <div class="acciones">
          <button type="button" class="boton boton--primario" disabled={ocupado} onClick={() => ejecutar(() => restaurarOcurrencia(ctx, e.id, clave))}>
            {t('calendario.ocurrencia.restaurar')}
          </button>
          <a class="boton" href={hrefDe(volver)}>
            {t('calendario.volver')}
          </a>
        </div>
        <LineaDeAviso aviso={aviso} />
      </div>
    );
  }

  const puedeCumplir = e.compromiso && !o.cumplida && ahora >= o.inicioMs && ahora <= o.finMs + HORAS_PARA_CUMPLIR * 3_600_000;

  return (
    <div class="pila" {...atributosDeColor(e.color)}>
      <article class="tarjeta pila">
        <h2 class="tarjeta__titulo fila__titulo">
          <span class="marca-color" aria-hidden="true" />
          <span class={o.cumplida ? 'tachado' : undefined}>{o.titulo}</span>
          <Marcas ctx={ctx} x={o} />
        </h2>
        <dl class="datos">
          <dt>{t('calendario.cuando')}</dt>
          <dd>
            <span class="cal-primera-mayuscula">{fechas.diaLargo(o.fechaInicio)}</span>
            {' · '}
            {o.todoElDia && o.fechaFin !== o.fechaInicio ? `${fechas.diaMes(o.fechaInicio)} – ${fechas.diaMes(o.fechaFin)}` : horarioDe(ctx, o)}
            {o.modificada && ` · ${t('calendario.ocurrencia.de', { fecha: fechas.diaLargo(clave) })} (${t('calendario.modificada').toLowerCase()})`}
          </dd>
          {o.lugar && (
            <>
              <dt>{t('calendario.campo.lugar')}</dt>
              <dd>{o.lugar}</dd>
            </>
          )}
          {o.notas && (
            <>
              <dt>{t('calendario.campo.notas')}</dt>
              <dd class="cal-notas">{o.notas}</dd>
            </>
          )}
          {e.recordatorios.length > 0 && (
            <>
              <dt>{t('calendario.campo.recordatorios')}</dt>
              <dd>{e.recordatorios.map((m) => textoDeRecordatorio(ctx, m)).join(' · ')}</dd>
            </>
          )}
        </dl>
        {e.vinculo && <LineaDeVinculo ctx={ctx} vinculo={e.vinculo} />}

        {e.compromiso && (
          <div class="pila">
            {o.cumplida ? (
              <button type="button" class="boton" disabled={ocupado} onClick={() => ejecutar(() => desmarcarCumplido(ctx, e.id, clave))}>
                {t('calendario.ocurrencia.desmarcar')}
              </button>
            ) : (
              <button type="button" class="boton boton--primario" disabled={ocupado || !puedeCumplir} onClick={() => ejecutar(() => marcarCumplido(ctx, e.id, clave), t('calendario.ocurrencia.marcada'))}>
                ★ {t('calendario.ocurrencia.marcar')}
              </button>
            )}
            {!o.cumplida && <p class="campo__ayuda">{t('calendario.ocurrencia.cumplirAyuda')}</p>}
          </div>
        )}

        <div class="acciones">
          {e.recurrencia ? (
            <>
              <button type="button" class="boton" aria-expanded={editando} onClick={() => setEditando(!editando)}>
                {t('calendario.ocurrencia.editarSolo')}
              </button>
              <a class="boton" href={hrefDe(`/calendario/eventos/${e.id}`)}>
                {t('calendario.ocurrencia.editarSerie')}
              </a>
              {excepcion && !excepcion.cancelada && (
                <button type="button" class="boton" disabled={ocupado} onClick={() => ejecutar(() => restaurarOcurrencia(ctx, e.id, clave), t('calendario.guardado'))}>
                  {t('calendario.ocurrencia.volverAOriginal')}
                </button>
              )}
              <button type="button" class="boton" disabled={ocupado} onClick={borrarSoloEsta}>
                {t('calendario.ocurrencia.borrarSolo')}
              </button>
            </>
          ) : (
            <a class="boton" href={hrefDe(`/calendario/eventos/${e.id}`)}>
              ✎ {t('calendario.editar')}
            </a>
          )}
          <a class="boton" href={hrefDe(volver)}>
            {t('calendario.volver')}
          </a>
        </div>
        <LineaDeAviso aviso={aviso} />
      </article>

      {editando && e.recurrencia && (
        <FormularioEvento
          ctx={ctx}
          inicial={borradorDesde(
            ctx,
            { ...e, titulo: o.titulo, lugar: o.lugar, notas: o.notas, inicio: o.todoElDia ? o.fechaInicio : new Date(o.inicioMs).toISOString(), fin: o.todoElDia ? o.fechaFin : new Date(o.finMs).toISOString() },
            e.todoElDia,
          )}
          modo="ocurrencia"
          textoGuardar={t('calendario.ocurrencia.guardarSolo')}
          volverA={`/calendario/eventos/${e.id}/${clave}`}
          alGuardar={async (datos) => {
            await editarOcurrencia(ctx, e.id, clave, aDatosDeOcurrencia(datos));
            setEditando(false);
            return t('calendario.guardado');
          }}
        />
      )}

      <button type="button" class="boton boton--peligro" onClick={eliminarTodo}>
        {e.recurrencia ? t('calendario.eliminarSerie') : t('calendario.eliminar')}
      </button>
    </div>
  );
}
