/** Piezas de UI compartidas por las pantallas de Universidad. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import type { Traductor } from '../../../nucleo/i18n/traductor';
import { hrefDe } from '../../../ui/enrutador';
import { completarEntregable } from '../aplicacion/completar-entregable';
import { estaVencido, PRIORIDADES, TALLAS, TIPOS, TITULO_MAX, type Entregable, type Prioridad, type Talla, type TipoDeEntregable } from '../dominio/entregable';
import { ErrorDeUniversidad, type CampoDeFormulario } from '../dominio/errores';
import type { Materia } from '../dominio/materia';

export function mensajeDeError(t: Traductor, error: unknown): string {
  return error instanceof ErrorDeUniversidad ? t(error.clave, error.parametros) : t('universidad.error.inesperado');
}

export type ErroresDeCampo = Partial<Record<CampoDeFormulario, string>>;

/** Traduce un error a mensaje por campo (si lo tiene) o general. */
export function repartirError(t: Traductor, error: unknown): { campos: ErroresDeCampo; general: string | null } {
  if (error instanceof ErrorDeUniversidad && error.campo) return { campos: { [error.campo]: mensajeDeError(t, error) }, general: null };
  return { campos: {}, general: mensajeDeError(t, error) };
}

/** Lleva el foco al primer campo con error (teclado y lectores de pantalla). */
export function enfocarPrimerError(formulario: HTMLFormElement | null): void {
  queueMicrotask(() => formulario?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export interface Aviso {
  ok: boolean;
  texto: string;
}

export function LineaDeAviso({ aviso }: { aviso: Aviso | null }) {
  // El contenedor existe siempre para que los lectores de pantalla anuncien los cambios.
  return (
    <div role="status" aria-live="polite">
      {aviso && <p class={aviso.ok ? 'aviso' : 'aviso aviso--alerta'}>{aviso.texto}</p>}
    </div>
  );
}

export function idDeAyuda(campo: string): string {
  return `universidad-${campo}-ayuda`;
}

export function idDeError(campo: string): string {
  return `universidad-${campo}-error`;
}

/** Atributos de accesibilidad de un control con ayuda y error opcionales. */
export function aria(campo: string, error: string | undefined, conAyuda = false) {
  const describe = [conAyuda ? idDeAyuda(campo) : '', error ? idDeError(campo) : ''].filter(Boolean).join(' ');
  return { 'aria-invalid': error ? ('true' as const) : undefined, 'aria-describedby': describe || undefined };
}

export function ErrorDeCampo({ campo, error }: { campo: string; error: string | undefined }) {
  return error ? (
    <span id={idDeError(campo)} class="campo__error">
      {error}
    </span>
  ) : null;
}

// ---------------------------------------------------------------------------
// Entregable en una lista
// ---------------------------------------------------------------------------

export function ItemEntregable({
  ctx,
  entregable: e,
  materia,
  alCompletar,
}: {
  ctx: ContextoDeModulo;
  entregable: Entregable;
  materia: Materia | undefined;
  alCompletar: (aviso: Aviso) => void;
}) {
  const { t, formatos } = ctx;
  const [ocupado, setOcupado] = useState(false);
  const ahora = ctx.reloj.ahora();
  const completado = e.estado === 'completado';

  const completar = async () => {
    setOcupado(true);
    try {
      await completarEntregable(ctx, e.id);
      alCompletar({ ok: true, texto: t('universidad.completadoOk') });
    } catch (error) {
      alCompletar({ ok: false, texto: mensajeDeError(t, error) });
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
            <a href={hrefDe(`/universidad/entregables/${e.id}`)} class={completado ? 'tachado' : undefined}>
              {e.titulo}
            </a>
          </span>
          <span class="texto-tenue">
            {[materia?.nombre, t(`universidad.tipo.${e.tipo}`), t('universidad.prioridadDe', { prioridad: t(`universidad.prioridad.${e.prioridad}`).toLowerCase() }), t('universidad.tallaDe', { talla: e.talla })]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span class="texto-tenue">
            {completado && e.completadoEn ? (
              <time dateTime={e.completadoEn}>{t('universidad.completadoEl', { fecha: formatos.fechaHora(e.completadoEn) })}</time>
            ) : (
              <time dateTime={e.venceEn}>{t('universidad.vence', { fecha: formatos.fechaHora(e.venceEn), relativo: formatos.relativo(e.venceEn, ahora) })}</time>
            )}
          </span>
        </div>
        <span class="acciones">
          {estaVencido(e, ahora) && <span class="etiqueta etiqueta--alerta">{t('universidad.vencido')}</span>}
          {e.estado === 'enCurso' && <span class="etiqueta">{t('universidad.estado.enCurso')}</span>}
          {completado ? (
            <span class="etiqueta">{t('universidad.estado.completado')}</span>
          ) : (
            <button
              type="button"
              class="boton"
              disabled={ocupado}
              onClick={completar}
              aria-label={t('universidad.completarTitulo', { titulo: e.titulo })}
            >
              ✓ {t('universidad.completar')}
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Campos del formulario de entregable (registrar y editar)
// ---------------------------------------------------------------------------

export interface BorradorDeEntregable {
  materiaId: string;
  titulo: string;
  tipo: TipoDeEntregable;
  /** Valor de <input type="datetime-local"> en hora de Bogotá. */
  venceEnLocal: string;
  prioridad: Prioridad;
  talla: Talla;
}

export const BORRADOR_VACIO: BorradorDeEntregable = { materiaId: '', titulo: '', tipo: 'tarea', venceEnLocal: '', prioridad: 'media', talla: 'M' };

function GrupoDeOpciones<T extends string>({
  nombre,
  leyenda,
  opciones,
  valor,
  etiqueta,
  alCambiar,
  desactivado = false,
  ayuda,
  error,
}: {
  nombre: string;
  leyenda: string;
  opciones: readonly T[];
  valor: T;
  etiqueta: (o: T) => string;
  alCambiar: (v: T) => void;
  desactivado?: boolean;
  ayuda?: ComponentChildren;
  error?: string;
}) {
  return (
    <fieldset class="grupo grupo--en-linea" {...aria(nombre, error, Boolean(ayuda))}>
      <legend>{leyenda}</legend>
      {opciones.map((o) => (
        <label key={o} class={desactivado ? 'opcion opcion--desactivada' : 'opcion'}>
          <input type="radio" name={`universidad-${nombre}`} value={o} checked={valor === o} disabled={desactivado} onChange={() => alCambiar(o)} />
          {etiqueta(o)}
        </label>
      ))}
      {ayuda && (
        <span id={idDeAyuda(nombre)} class="campo__ayuda">
          {ayuda}
        </span>
      )}
      <ErrorDeCampo campo={nombre} error={error} />
    </fieldset>
  );
}

export function CamposDeEntregable({
  ctx,
  borrador,
  cambiar,
  materias,
  errores,
  tallaBloqueada = false,
  fechaBloqueada = false,
}: {
  ctx: ContextoDeModulo;
  borrador: BorradorDeEntregable;
  cambiar: (cambios: Partial<BorradorDeEntregable>) => void;
  /** Materias elegibles; `null` = la materia no se puede cambiar (edición). */
  materias: readonly Materia[] | null;
  errores: ErroresDeCampo;
  tallaBloqueada?: boolean;
  fechaBloqueada?: boolean;
}) {
  const { t, formatos } = ctx;
  const instante = formatos.desdeEntradaLocal(borrador.venceEnLocal);
  const fechaPasada = !fechaBloqueada && instante !== null && Date.parse(instante) < ctx.reloj.ahora().getTime();
  const valor = (e: Event) => (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;

  return (
    <>
      {materias && (
        <label class="campo">
          <span>{t('universidad.campo.materia')}</span>
          <select value={borrador.materiaId} onChange={(e) => cambiar({ materiaId: valor(e) })} {...aria('materia', errores.materia)}>
            <option value="">{t('universidad.campo.elegirMateria')}</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          <ErrorDeCampo campo="materia" error={errores.materia} />
        </label>
      )}

      <label class="campo">
        <span>{t('universidad.campo.titulo')}</span>
        <input
          value={borrador.titulo}
          maxLength={TITULO_MAX}
          autoComplete="off"
          onInput={(e) => cambiar({ titulo: valor(e) })}
          {...aria('titulo', errores.titulo, true)}
        />
        <span id={idDeAyuda('titulo')} class="campo__ayuda">
          {t('universidad.campo.tituloAyuda', { max: TITULO_MAX })}
        </span>
        <ErrorDeCampo campo="titulo" error={errores.titulo} />
      </label>

      <label class="campo">
        <span>{t('universidad.campo.tipo')}</span>
        <select value={borrador.tipo} onChange={(e) => cambiar({ tipo: valor(e) as TipoDeEntregable })}>
          {TIPOS.map((tipo) => (
            <option key={tipo} value={tipo}>
              {t(`universidad.tipo.${tipo}`)}
            </option>
          ))}
        </select>
      </label>

      <label class="campo">
        <span>{t('universidad.campo.venceEn')}</span>
        <input
          type="datetime-local"
          value={borrador.venceEnLocal}
          disabled={fechaBloqueada}
          onInput={(e) => cambiar({ venceEnLocal: valor(e) })}
          {...aria('venceEn', errores.venceEn, true)}
        />
        <span id={idDeAyuda('venceEn')} class="campo__ayuda">
          {fechaBloqueada ? t('universidad.campo.venceEnBloqueada') : t('universidad.campo.venceEnAyuda')}
        </span>
        {fechaPasada && <span class="aviso aviso--alerta">{t('universidad.campo.fechaPasada')}</span>}
        <ErrorDeCampo campo="venceEn" error={errores.venceEn} />
      </label>

      <GrupoDeOpciones
        nombre="prioridad"
        leyenda={t('universidad.campo.prioridad')}
        opciones={PRIORIDADES}
        valor={borrador.prioridad}
        etiqueta={(p) => t(`universidad.prioridad.${p}`)}
        alCambiar={(prioridad) => cambiar({ prioridad })}
      />

      <GrupoDeOpciones
        nombre="talla"
        leyenda={t('universidad.campo.talla')}
        opciones={TALLAS}
        valor={borrador.talla}
        etiqueta={(talla) => talla}
        alCambiar={(talla) => cambiar({ talla })}
        desactivado={tallaBloqueada}
        ayuda={tallaBloqueada ? t('universidad.campo.tallaBloqueada') : t('universidad.campo.tallaAyuda')}
        error={errores.talla}
      />
    </>
  );
}
