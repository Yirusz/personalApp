/** Piezas de UI compartidas por las pantallas de Universidad. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import type { Traductor } from '../../../nucleo/i18n/traductor';
import { hrefDe } from '../../../ui/enrutador';
import { zonaDelUsuario } from '../aplicacion/comun';
import { entregarTrabajo } from '../aplicacion/trabajos';
import { indicador } from '../dominio/consultas';
import { ErrorDeUniversidad, type CampoDeFormulario } from '../dominio/errores';
import type { Materia } from '../dominio/materia';
import { pesoDesdeTexto, textoDeNota, textoDePeso } from '../dominio/nota';
import { aTiempo, DESCRIPCION_MAX, esActivo, PRIORIDADES, progreso, TIPOS, TITULO_MAX, titulo as tituloValido, type Prioridad, type TipoDeTrabajo, type Trabajo } from '../dominio/trabajo';

// ---- Errores y campos ----

export function mensajeDeError(t: Traductor, error: unknown): string {
  return error instanceof ErrorDeUniversidad ? t(error.clave, error.parametros) : t('universidad.error.inesperado');
}

export type ErroresDeCampo = Partial<Record<CampoDeFormulario, string>>;

export function repartirError(t: Traductor, error: unknown): { campos: ErroresDeCampo; general: string | null } {
  if (error instanceof ErrorDeUniversidad && error.campo) return { campos: { [error.campo]: mensajeDeError(t, error) }, general: null };
  return { campos: {}, general: mensajeDeError(t, error) };
}

export function enfocarPrimerError(formulario: HTMLFormElement | null): void {
  queueMicrotask(() => formulario?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export const idDeControl = (campo: string) => `universidad-${campo}`;
const idDeAyuda = (campo: string) => `universidad-${campo}-ayuda`;
const idDeError = (campo: string) => `universidad-${campo}-error`;

/** id, aria-invalid y aria-describedby de un control. */
export function aria(campo: string, error: string | undefined, conAyuda = false) {
  const describe = [conAyuda ? idDeAyuda(campo) : '', error ? idDeError(campo) : ''].filter(Boolean).join(' ');
  return { id: idDeControl(campo), 'aria-invalid': error ? ('true' as const) : undefined, 'aria-describedby': describe || undefined };
}

export function ErrorDeCampo({ campo, error }: { campo: string; error: string | undefined }) {
  return error ? (
    <span id={idDeError(campo)} class="campo__error">
      {error}
    </span>
  ) : null;
}

/** Etiqueta, control, ayuda y error separados: el nombre accesible es solo la etiqueta. */
export function Campo(props: { campo: string; etiqueta: string; ayuda?: ComponentChildren; error?: string; despues?: ComponentChildren; children: ComponentChildren; clase?: string }) {
  return (
    <div class={props.clase ?? 'campo'}>
      <label for={idDeControl(props.campo)}>{props.etiqueta}</label>
      {props.children}
      {props.ayuda && (
        <span id={idDeAyuda(props.campo)} class="campo__ayuda">
          {props.ayuda}
        </span>
      )}
      {props.despues}
      <ErrorDeCampo campo={props.campo} error={props.error} />
    </div>
  );
}

export interface Aviso {
  ok: boolean;
  texto: string;
}

export function LineaDeAviso({ aviso }: { aviso: Aviso | null }) {
  return (
    <div role="status" aria-live="polite">
      {aviso && <p class={aviso.ok ? 'aviso' : 'aviso aviso--alerta'}>{aviso.texto}</p>}
    </div>
  );
}

// ---- Un trabajo en una lista ----

const CLASE_INDICADOR = { vencido: 'etiqueta etiqueta--peligro', hoy: 'etiqueta etiqueta--alerta', semana: 'etiqueta' } as const;

export function IndicadorDeUrgencia({ ctx, trabajo }: { ctx: ContextoDeModulo; trabajo: Trabajo }) {
  const i = indicador(trabajo, ctx.reloj.ahora(), zonaDelUsuario());
  if (i === 'cerrado' || i === 'despues') return null;
  return <span class={CLASE_INDICADOR[i]}>{ctx.t(`universidad.indicador.${i}`)}</span>;
}

export function detalleDeTrabajo(ctx: ContextoDeModulo, t: Trabajo, materia: Materia | undefined): string {
  return [
    materia?.nombre,
    ctx.t(`universidad.tipo.${t.tipo}`),
    ctx.t('universidad.prioridadDe', { prioridad: ctx.t(`universidad.prioridad.${t.prioridad}`).toLowerCase() }),
    t.peso !== null ? ctx.t('universidad.pesoDe', { peso: textoDePeso(t.peso) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function ItemTrabajo({ ctx, trabajo: t, materia, alCambiar }: { ctx: ContextoDeModulo; trabajo: Trabajo; materia: Materia | undefined; alCambiar: (aviso: Aviso) => void }) {
  const { t: tr, formatos } = ctx;
  const [ocupado, setOcupado] = useState(false);
  const ahora = ctx.reloj.ahora();
  const p = progreso(t);
  const entregar = async () => {
    setOcupado(true);
    try {
      await entregarTrabajo(ctx, t.id);
      alCambiar({ ok: true, texto: tr('universidad.entregadoOk') });
    } catch (error) {
      alCambiar({ ok: false, texto: mensajeDeError(tr, error) });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <li class="lista__item" data-color={materia?.color}>
      <div class="fila">
        <div class="fila__principal">
          <span class="fila__titulo">
            <span class="marca-color" aria-hidden="true" />
            <a href={hrefDe(`/universidad/trabajos/${t.id}`)} class={t.estado === 'cancelado' ? 'tachado' : undefined}>
              {t.titulo}
            </a>
          </span>
          <span class="texto-tenue">{detalleDeTrabajo(ctx, t, materia)}</span>
          <span class="texto-tenue">
            {t.entregadoEn ? (
              <time dateTime={t.entregadoEn}>
                {tr('universidad.entregadoEl', { fecha: formatos.fechaHora(t.entregadoEn) })} · {aTiempo(t) ? tr('universidad.aTiempo') : tr('universidad.tarde')}
              </time>
            ) : (
              <time dateTime={t.venceEn}>{tr('universidad.vence', { fecha: formatos.fechaHora(t.venceEn), relativo: formatos.relativo(t.venceEn, ahora) })}</time>
            )}
            {p.total > 0 && ` · ${tr('universidad.subtareasDe', p)}`}
          </span>
        </div>
        <span class="acciones">
          <IndicadorDeUrgencia ctx={ctx} trabajo={t} />
          {t.estado !== 'pendiente' && <span class="etiqueta">{tr(`universidad.estado.${t.estado}`)}</span>}
          {t.nota !== undefined && <span class="etiqueta">{tr('universidad.notaDe', { nota: textoDeNota(t.nota) })}</span>}
          {esActivo(t.estado) && (
            <button type="button" class="boton" disabled={ocupado} onClick={entregar} aria-label={tr('universidad.entregarTitulo', { titulo: t.titulo })}>
              ✓ {tr('universidad.entregar')}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

// ---- Formulario de trabajo (registrar y editar) ----

export interface BorradorDeTrabajo {
  materiaId: string;
  titulo: string;
  tipo: TipoDeTrabajo;
  descripcion: string;
  venceEnLocal: string;
  prioridad: Prioridad;
  /** Tal como lo escribe el usuario ("12,5"). */
  peso: string;
}

export const BORRADOR_VACIO: BorradorDeTrabajo = { materiaId: '', titulo: '', tipo: 'tarea', descripcion: '', venceEnLocal: '', prioridad: 'media', peso: '' };

/** Revisa todo el borrador para señalar a la vez todos los campos con problemas (el dominio vuelve a validar). */
export function revisarBorrador(ctx: ContextoDeModulo, b: BorradorDeTrabajo, opciones: { conMateria: boolean; fechaBloqueada?: boolean }) {
  const errores: ErroresDeCampo = {};
  if (opciones.conMateria && !b.materiaId) errores.materia = ctx.t('universidad.error.materiaNoEncontrada');
  try {
    tituloValido(b.titulo);
  } catch (e) {
    errores.titulo = mensajeDeError(ctx.t, e);
  }
  const venceEn = ctx.formatos.desdeEntradaLocal(b.venceEnLocal);
  if (!opciones.fechaBloqueada && !venceEn) errores.venceEn = ctx.t('universidad.error.fecha');
  let peso: number | null = null;
  try {
    peso = pesoDesdeTexto(b.peso);
  } catch (e) {
    errores.peso = mensajeDeError(ctx.t, e);
  }
  return { errores, venceEn, peso, valido: Object.keys(errores).length === 0 };
}

/** Quita el error de los campos que el usuario acaba de cambiar. */
export function limpiarErrores(e: ErroresDeCampo, cambios: Partial<BorradorDeTrabajo>): ErroresDeCampo {
  const copia = { ...e };
  const mapa: Record<string, CampoDeFormulario> = { materiaId: 'materia', venceEnLocal: 'venceEn' };
  for (const k of Object.keys(cambios)) delete copia[mapa[k] ?? (k as CampoDeFormulario)];
  return copia;
}

export function CamposDeTrabajo({
  ctx,
  borrador: b,
  cambiar,
  materias,
  errores,
  tipoBloqueado = false,
  fechaBloqueada = false,
}: {
  ctx: ContextoDeModulo;
  borrador: BorradorDeTrabajo;
  cambiar: (c: Partial<BorradorDeTrabajo>) => void;
  /** Materias elegibles; null = la materia no se cambia (edición). */
  materias: readonly Materia[] | null;
  errores: ErroresDeCampo;
  tipoBloqueado?: boolean;
  fechaBloqueada?: boolean;
}) {
  const { t } = ctx;
  const instante = ctx.formatos.desdeEntradaLocal(b.venceEnLocal);
  const fechaPasada = !fechaBloqueada && instante !== null && Date.parse(instante) < ctx.reloj.ahora().getTime();
  const valor = (e: Event) => (e.currentTarget as HTMLInputElement).value;
  return (
    <>
      {materias && (
        <Campo campo="materia" etiqueta={t('universidad.campo.materia')} error={errores.materia}>
          <select value={b.materiaId} onChange={(e) => cambiar({ materiaId: valor(e) })} {...aria('materia', errores.materia)}>
            <option value="">{t('universidad.campo.elegirMateria')}</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.periodo})
              </option>
            ))}
          </select>
        </Campo>
      )}
      <Campo campo="titulo" etiqueta={t('universidad.campo.titulo')} ayuda={t('universidad.campo.tituloAyuda', { max: TITULO_MAX })} error={errores.titulo}>
        <input value={b.titulo} maxLength={TITULO_MAX} autoComplete="off" onInput={(e) => cambiar({ titulo: valor(e) })} {...aria('titulo', errores.titulo, true)} />
      </Campo>
      <div class="filtros">
        <Campo campo="tipo" etiqueta={t('universidad.campo.tipo')} ayuda={tipoBloqueado ? t('universidad.campo.tipoBloqueado') : undefined} error={errores.tipo}>
          <select value={b.tipo} disabled={tipoBloqueado} onChange={(e) => cambiar({ tipo: valor(e) as TipoDeTrabajo })} {...aria('tipo', errores.tipo, tipoBloqueado)}>
            {TIPOS.map((x) => (
              <option key={x} value={x}>
                {t(`universidad.tipo.${x}`)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo campo="peso" etiqueta={t('universidad.campo.peso')} ayuda={t('universidad.campo.pesoAyuda')} error={errores.peso}>
          <input inputMode="decimal" value={b.peso} disabled={tipoBloqueado} autoComplete="off" onInput={(e) => cambiar({ peso: valor(e) })} {...aria('peso', errores.peso, true)} />
        </Campo>
      </div>
      <Campo
        campo="venceEn"
        etiqueta={t('universidad.campo.venceEn')}
        ayuda={fechaBloqueada ? t('universidad.campo.venceEnBloqueada') : t('universidad.campo.venceEnAyuda')}
        error={errores.venceEn}
        despues={fechaPasada && <span class="aviso aviso--alerta">{t('universidad.campo.fechaPasada')}</span>}
      >
        <input type="datetime-local" value={b.venceEnLocal} disabled={fechaBloqueada} onInput={(e) => cambiar({ venceEnLocal: valor(e) })} {...aria('venceEn', errores.venceEn, true)} />
      </Campo>
      <fieldset class="grupo grupo--en-linea">
        <legend>{t('universidad.campo.prioridad')}</legend>
        {PRIORIDADES.map((p) => (
          <label key={p} class="opcion">
            <input type="radio" name="universidad-prioridad" checked={b.prioridad === p} onChange={() => cambiar({ prioridad: p })} />
            {t(`universidad.prioridad.${p}`)}
          </label>
        ))}
      </fieldset>
      <Campo campo="descripcion" etiqueta={t('universidad.campo.descripcion')} error={errores.descripcion}>
        <textarea rows={3} value={b.descripcion} maxLength={DESCRIPCION_MAX} onInput={(e) => cambiar({ descripcion: (e.currentTarget as HTMLTextAreaElement).value })} {...aria('descripcion', errores.descripcion)} />
      </Campo>
    </>
  );
}
