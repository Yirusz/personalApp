/** Historias 3, 5 y 6: estado, nota, subtareas, edición y eliminación (con deshacer) de un trabajo. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer, useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { ALMACENES_DEL_PANEL, leerTrabajoConMateria } from '../aplicacion/consultas';
import {
  agregarSubtarea,
  calificarTrabajo,
  cancelarTrabajo,
  editarTrabajo,
  eliminarTrabajo,
  entregarTrabajo,
  iniciarTrabajo,
  marcarSubtarea,
  quitarSubtarea,
  reabrirTrabajo,
  reprogramarTrabajo,
} from '../aplicacion/trabajos';
import type { Materia } from '../dominio/materia';
import { notaDesdeTexto, textoDeNota, textoDePeso } from '../dominio/nota';
import { aTiempo, esActivo, progreso, SUBTAREA_MAX, transicionesPosibles, type Accion, type Trabajo } from '../dominio/trabajo';
import {
  aria,
  Campo,
  CamposDeTrabajo,
  detalleDeTrabajo,
  enfocarPrimerError,
  ErrorDeCampo,
  IndicadorDeUrgencia,
  LineaDeAviso,
  limpiarErrores,
  mensajeDeError,
  repartirError,
  revisarBorrador,
  type Aviso,
  type BorradorDeTrabajo,
  type ErroresDeCampo,
} from './comun';

export function VistaTrabajo({ ctx, params }: PropsDeVista) {
  const id = params.id ?? '';
  const consulta = useConsulta(ctx.almacen, ALMACENES_DEL_PANEL, (tx) => leerTrabajoConMateria(tx, id));
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
  return <Detalle ctx={ctx} trabajo={consulta.datos.trabajo} materia={consulta.datos.materia} />;
}

const borradorDe = (ctx: ContextoDeModulo, t: Trabajo): BorradorDeTrabajo => ({
  materiaId: t.materiaId,
  titulo: t.titulo,
  tipo: t.tipo,
  descripcion: t.descripcion,
  venceEnLocal: ctx.formatos.entradaLocal(t.venceEn),
  prioridad: t.prioridad,
  peso: t.peso === null ? '' : textoDePeso(t.peso).replace(' %', ''),
});

function Detalle({ ctx, trabajo: tr, materia }: { ctx: ContextoDeModulo; trabajo: Trabajo; materia: Materia | undefined }) {
  const { t, formatos } = ctx;
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const acciones = transicionesPosibles(tr);

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

  const hacer: Partial<Record<Accion, () => void>> = {
    iniciar: () => ejecutar(() => iniciarTrabajo(ctx, tr.id), t('universidad.guardado')),
    entregar: () => ejecutar(() => entregarTrabajo(ctx, tr.id), t('universidad.entregadoOk')),
    cancelar: () => ejecutar(() => cancelarTrabajo(ctx, tr.id), t('universidad.guardado')),
    reabrir: () => ejecutar(() => reabrirTrabajo(ctx, tr.id), t('universidad.guardado')),
  };

  const eliminar = () => {
    void ofrecerDeshacer({ mensaje: t('universidad.eliminado'), ocultar: tr.id, confirmar: () => eliminarTrabajo(ctx, tr.id) });
    ctx.navegar('/universidad');
  };

  return (
    <div class="pila" data-color={materia?.color}>
      <article class="tarjeta pila">
        <h2 class="tarjeta__titulo fila__titulo">
          <span class="marca-color" aria-hidden="true" />
          <span class={tr.estado === 'cancelado' ? 'tachado' : undefined}>{tr.titulo}</span>
        </h2>
        <p class="texto-tenue">{detalleDeTrabajo(ctx, tr, materia)}</p>
        <p class="acciones">
          <span class="etiqueta">{t(`universidad.estado.${tr.estado}`)}</span>
          <IndicadorDeUrgencia ctx={ctx} trabajo={tr} />
          {tr.nota !== undefined && <span class="etiqueta">{t('universidad.notaDe', { nota: textoDeNota(tr.nota) })}</span>}
        </p>
        <dl class="datos">
          <dt>{t('universidad.campo.venceEn')}</dt>
          <dd>
            <time dateTime={tr.venceEn}>{formatos.fechaHora(tr.venceEn)}</time> ({formatos.relativo(tr.venceEn, ctx.reloj.ahora())})
          </dd>
          {tr.entregadoEn && (
            <>
              <dt>{t('universidad.estado.entregado')}</dt>
              <dd>
                <time dateTime={tr.entregadoEn}>{formatos.fechaHora(tr.entregadoEn)}</time> · {aTiempo(tr) ? t('universidad.aTiempo') : t('universidad.tarde')}
              </dd>
            </>
          )}
          {tr.descripcion && (
            <>
              <dt>{t('universidad.campo.descripcion')}</dt>
              <dd class="universidad-descripcion">{tr.descripcion}</dd>
            </>
          )}
        </dl>
        <div class="acciones" role="group" aria-label={t('universidad.acciones')}>
          {acciones
            .filter((a) => a !== 'calificar')
            .map((a) => (
              <button key={a} type="button" class={a === 'entregar' ? 'boton boton--primario' : 'boton'} disabled={ocupado} onClick={hacer[a]}>
                {a === 'entregar' ? '✓ ' : ''}
                {t(`universidad.accion.${a}`)}
              </button>
            ))}
        </div>
        {acciones.includes('reabrir') && <p class="campo__ayuda">{t('universidad.reabrirAyuda')}</p>}
        <LineaDeAviso aviso={aviso} />
      </article>

      {acciones.includes('calificar') && <FormularioDeNota ctx={ctx} trabajo={tr} />}

      <Subtareas ctx={ctx} trabajo={tr} />

      <Seccion titulo={t('universidad.editar')}>
        <FormularioDeEdicion ctx={ctx} trabajo={tr} />
      </Seccion>

      <button type="button" class="boton boton--peligro" onClick={eliminar}>
        {t('universidad.eliminar')}
      </button>
    </div>
  );
}

/** Historia 6: nota 0,0–5,0 (se guarda en décimas). */
function FormularioDeNota({ ctx, trabajo: tr }: { ctx: ContextoDeModulo; trabajo: Trabajo }) {
  const { t } = ctx;
  const [texto, setTexto] = useState(tr.nota === undefined ? '' : textoDeNota(tr.nota));
  const [error, setError] = useState<string | undefined>();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const guardar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    try {
      await calificarTrabajo(ctx, tr.id, notaDesdeTexto(texto));
      setError(undefined);
      setAviso({ ok: true, texto: t('universidad.notaGuardada') });
    } catch (err) {
      setError(mensajeDeError(t, err));
      campo.current?.focus();
    }
  };
  return (
    <form class="tarjeta pila" onSubmit={guardar} noValidate>
      <Campo campo="nota" etiqueta={t('universidad.campo.nota')} ayuda={t('universidad.campo.notaAyuda')} error={error}>
        <input
          ref={campo}
          inputMode="decimal"
          autoComplete="off"
          class="universidad-nota"
          value={texto}
          onInput={(e) => {
            setTexto((e.currentTarget as HTMLInputElement).value);
            setError(undefined);
          }}
          {...aria('nota', error, true)}
        />
      </Campo>
      <div class="acciones">
        <button type="submit" class="boton boton--primario">
          {t('universidad.accion.calificar')}
        </button>
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}

/** Historia 5: subtareas con casillas (sin XP). */
function Subtareas({ ctx, trabajo: tr }: { ctx: ContextoDeModulo; trabajo: Trabajo }) {
  const { t } = ctx;
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const campo = useRef<HTMLInputElement>(null);
  const p = progreso(tr);
  const permitido = tr.estado !== 'cancelado';
  const agregar = async (e: Event) => {
    e.preventDefault();
    try {
      await agregarSubtarea(ctx, tr.id, texto);
      setTexto('');
      setError(undefined);
    } catch (err) {
      setError(mensajeDeError(t, err));
    }
    campo.current?.focus();
  };
  return (
    <Seccion titulo={`${t('universidad.subtareas')}${p.total > 0 ? ` · ${t('universidad.subtareasDe', p)}` : ''}`}>
      <div class="tarjeta pila">
        <p class="campo__ayuda">{t('universidad.subtareasAyuda')}</p>
        {p.total > 0 && <progress class="universidad-progreso" max={p.total} value={p.hechas} aria-label={t('universidad.subtareasDe', p)} />}
        {tr.subtareas.length === 0 ? (
          <p class="texto-tenue">{t('universidad.subtareasVacio')}</p>
        ) : (
          <ul class="universidad-subtareas">
            {tr.subtareas.map((s) => (
              <li key={s.id} class="fila">
                <label class="opcion">
                  <input type="checkbox" checked={s.hecha} disabled={!permitido} onChange={(e) => void marcarSubtarea(ctx, tr.id, s.id, (e.currentTarget as HTMLInputElement).checked)} />
                  <span class={s.hecha ? 'tachado' : undefined}>{s.texto}</span>
                </label>
                <button type="button" class="boton" aria-label={t('universidad.subtareaQuitar', { texto: s.texto })} onClick={() => void quitarSubtarea(ctx, tr.id, s.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {permitido && (
          <form class="fila" onSubmit={agregar} noValidate>
            <div class="campo fila__principal">
              <label for="universidad-subtarea">{t('universidad.subtareaNueva')}</label>
              <input
                ref={campo}
                value={texto}
                maxLength={SUBTAREA_MAX}
                autoComplete="off"
                onInput={(e) => {
                  setTexto((e.currentTarget as HTMLInputElement).value);
                  setError(undefined);
                }}
                {...aria('subtarea', error)}
              />
              <ErrorDeCampo campo="subtarea" error={error} />
            </div>
            <button type="submit" class="boton">
              + {t('universidad.subtareaAgregar')}
            </button>
          </form>
        )}
      </div>
    </Seccion>
  );
}

function FormularioDeEdicion({ ctx, trabajo: tr }: { ctx: ContextoDeModulo; trabajo: Trabajo }) {
  const { t } = ctx;
  const [b, setB] = useState(() => borradorDe(ctx, tr));
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const activo = esActivo(tr.estado);
  const bloqueado = tr.estado === 'entregado' || tr.estado === 'calificado';
  useEffect(() => setB(borradorDe(ctx, tr)), [tr.actualizadoEn]);

  const guardar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    const r = revisarBorrador(ctx, b, { conMateria: false, fechaBloqueada: !activo });
    if (!r.valido) {
      setErrores(r.errores);
      enfocarPrimerError(formulario.current);
      return;
    }
    setOcupado(true);
    try {
      await editarTrabajo(ctx, tr.id, { titulo: b.titulo, descripcion: b.descripcion, prioridad: b.prioridad, ...(bloqueado ? {} : { tipo: b.tipo, peso: r.peso }) });
      if (activo) await reprogramarTrabajo(ctx, tr.id, r.venceEn!);
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

  return (
    <form ref={formulario} class="tarjeta pila" onSubmit={guardar} noValidate>
      <CamposDeTrabajo
        ctx={ctx}
        borrador={b}
        cambiar={(c) => {
          setB((x) => ({ ...x, ...c }));
          setErrores((x) => limpiarErrores(x, c));
        }}
        materias={null}
        errores={errores}
        tipoBloqueado={bloqueado}
        fechaBloqueada={!activo}
      />
      <div class="acciones">
        <button class="boton boton--primario" type="submit" disabled={ocupado}>
          {t('universidad.guardar')}
        </button>
        <a class="boton" href={hrefDe('/universidad')}>
          {t('universidad.volver')}
        </a>
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}
