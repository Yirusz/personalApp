/** U4 y U6: estado, edición, reprogramación y eliminación (con deshacer) de un entregable. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer, useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { ENTREGABLES, MATERIAS } from '../aplicacion/comun';
import { completarEntregable } from '../aplicacion/completar-entregable';
import { leerEntregableConMateria } from '../aplicacion/consultas';
import { editarEntregable } from '../aplicacion/editar-entregable';
import { eliminarEntregable } from '../aplicacion/eliminar-entregable';
import { iniciarEntregable } from '../aplicacion/iniciar-entregable';
import { reabrirEntregable } from '../aplicacion/reabrir-entregable';
import { reprogramarEntregable } from '../aplicacion/reprogramar-entregable';
import { estaVencido, type Entregable } from '../dominio/entregable';
import { FechaInvalida } from '../dominio/errores';
import type { Materia } from '../dominio/materia';
import {
  CamposDeEntregable,
  enfocarPrimerError,
  LineaDeAviso,
  mensajeDeError,
  repartirError,
  type Aviso,
  type BorradorDeEntregable,
  type ErroresDeCampo,
} from './comun';

export function VistaEntregable({ ctx, params }: PropsDeVista) {
  const id = params.id ?? '';
  const consulta = useConsulta(ctx.almacen, [MATERIAS, ENTREGABLES], (tx) => leerEntregableConMateria(tx, id));
  const oculto = useOcultoPorDeshacer();

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  if (!consulta.datos || oculto === id) {
    return (
      <div class="pila">
        <Vacio>{ctx.t('universidad.noExiste')}</Vacio>
        <a class="boton" href={hrefDe('/universidad')}>
          {ctx.t('universidad.volver')}
        </a>
      </div>
    );
  }
  return <Detalle key={id} ctx={ctx} entregable={consulta.datos.entregable} materia={consulta.datos.materia} />;
}

function borradorDe(ctx: ContextoDeModulo, e: Entregable): BorradorDeEntregable {
  return {
    materiaId: e.materiaId,
    titulo: e.titulo,
    tipo: e.tipo,
    venceEnLocal: ctx.formatos.entradaLocal(e.venceEn),
    prioridad: e.prioridad,
    talla: e.talla,
  };
}

function Detalle({ ctx, entregable: e, materia }: { ctx: ContextoDeModulo; entregable: Entregable; materia: Materia | undefined }) {
  const { t, formatos } = ctx;
  const [borrador, setBorrador] = useState(() => borradorDe(ctx, e));
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const ahora = ctx.reloj.ahora();
  const completado = e.estado === 'completado';

  // Si el entregable cambia por otra vía (otra pestaña, una acción de estado), el formulario se pone al día.
  useEffect(() => setBorrador(borradorDe(ctx, e)), [e.actualizadoEn]);

  const ejecutar = async (accion: () => Promise<unknown>, exito: string) => {
    setOcupado(true);
    setAviso(null);
    try {
      await accion();
      setAviso({ ok: true, texto: exito });
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    } finally {
      setOcupado(false);
    }
  };

  const guardar = async (ev: Event) => {
    ev.preventDefault();
    setOcupado(true);
    setAviso(null);
    try {
      const venceEn = completado ? e.venceEn : formatos.desdeEntradaLocal(borrador.venceEnLocal);
      if (!venceEn) throw new FechaInvalida('Fecha vacía o inválida');
      // Primero se valida todo lo que puede fallar por datos (título, talla); luego la fecha.
      await editarEntregable(ctx, e.id, { titulo: borrador.titulo, tipo: borrador.tipo, prioridad: borrador.prioridad, talla: borrador.talla });
      if (!completado) await reprogramarEntregable(ctx, e.id, venceEn);
      setErrores({});
      setAviso({ ok: true, texto: t('universidad.guardado') });
    } catch (error) {
      const { campos, general } = repartirError(t, error);
      setErrores(campos);
      if (general) setAviso({ ok: false, texto: general });
      enfocarPrimerError(formulario.current);
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = () => {
    void ofrecerDeshacer({
      mensaje: t('universidad.eliminado'),
      ocultar: e.id,
      confirmar: () => eliminarEntregable(ctx, e.id),
    });
    ctx.navegar('/universidad');
  };

  return (
    <div class="pila" data-color={materia?.color}>
      <article class="tarjeta">
        <h2 class="tarjeta__titulo fila__titulo">
          <span class="marca-color" aria-hidden="true" />
          <span class={completado ? 'tachado' : undefined}>{e.titulo}</span>
        </h2>
        <p class="texto-tenue">
          {[materia?.nombre, t(`universidad.tipo.${e.tipo}`), t('universidad.tallaDe', { talla: e.talla })].filter(Boolean).join(' · ')}
        </p>
        <p class="acciones">
          <span class="etiqueta">{t(`universidad.estado.${e.estado}`)}</span>
          {estaVencido(e, ahora) && <span class="etiqueta etiqueta--alerta">{t('universidad.vencido')}</span>}
        </p>
        <dl class="datos">
          <dt>{t('universidad.campo.venceEn')}</dt>
          <dd>
            <time dateTime={e.venceEn}>{formatos.fechaHora(e.venceEn)}</time> ({formatos.relativo(e.venceEn, ahora)})
          </dd>
          {e.completadoEn && (
            <>
              <dt>{t('universidad.estado.completado')}</dt>
              <dd>
                <time dateTime={e.completadoEn}>{formatos.fechaHora(e.completadoEn)}</time> ·{' '}
                {Date.parse(e.completadoEn) <= Date.parse(e.venceEn) ? t('universidad.aTiempo') : t('universidad.tarde')}
              </dd>
            </>
          )}
          <dt>{t('universidad.registradoEn')}</dt>
          <dd>
            <time dateTime={e.creadoEn}>{formatos.fechaHora(e.creadoEn)}</time>
          </dd>
        </dl>
        <div class="acciones" role="group" aria-label={t('universidad.acciones')}>
          {e.estado === 'pendiente' && (
            <button type="button" class="boton" disabled={ocupado} onClick={() => ejecutar(() => iniciarEntregable(ctx, e.id), t('universidad.guardado'))}>
              {t('universidad.empezar')}
            </button>
          )}
          {!completado && (
            <button
              type="button"
              class="boton boton--primario"
              disabled={ocupado}
              onClick={() => ejecutar(() => completarEntregable(ctx, e.id), t('universidad.completadoOk'))}
            >
              ✓ {t('universidad.completar')}
            </button>
          )}
          {completado && (
            <button type="button" class="boton" disabled={ocupado} onClick={() => ejecutar(() => reabrirEntregable(ctx, e.id), t('universidad.guardado'))}>
              {t('universidad.reabrir')}
            </button>
          )}
        </div>
        <LineaDeAviso aviso={aviso} />
      </article>

      <Seccion titulo={t('universidad.editar')}>
        <form ref={formulario} class="tarjeta" onSubmit={guardar} noValidate>
          <CamposDeEntregable
            ctx={ctx}
            borrador={borrador}
            cambiar={(c) => setBorrador((b) => ({ ...b, ...c }))}
            materias={null}
            errores={errores}
            tallaBloqueada={e.estado !== 'pendiente'}
            fechaBloqueada={completado}
          />
          <div class="acciones">
            <button class="boton boton--primario" type="submit" disabled={ocupado}>
              {t('universidad.guardar')}
            </button>
            <a class="boton" href={hrefDe('/universidad')}>
              {t('universidad.volver')}
            </a>
          </div>
        </form>
      </Seccion>

      <button type="button" class="boton boton--peligro" onClick={eliminar}>
        {t('universidad.eliminar')}
      </button>
    </div>
  );
}
