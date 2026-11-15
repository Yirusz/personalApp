/** Piezas de UI compartidas por las pantallas del Calendario. */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import type { Traductor } from '../../../nucleo/i18n/traductor';
import { useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { ALMACENES_DE_FUENTES, leerFuentes, visiblesEnRango, type Lectura, type Visibles } from '../aplicacion/fuentes';
import { zonaDelUsuario } from '../aplicacion/comun';
import { ErrorDeCalendario, type CampoDeEvento } from '../dominio/errores';
import type { ElementoVisible, Rango } from '../dominio/visible';
import './calendario.css';

// ---------------------------------------------------------------------------
// Errores y campos de formulario
// ---------------------------------------------------------------------------

export function mensajeDeError(t: Traductor, error: unknown): string {
  return error instanceof ErrorDeCalendario ? t(error.clave, error.parametros) : t('calendario.error.inesperado');
}

export type ErroresDeCampo = Partial<Record<CampoDeEvento, string>>;

export function repartirError(t: Traductor, error: unknown): { campos: ErroresDeCampo; general: string | null } {
  if (error instanceof ErrorDeCalendario && error.campo) return { campos: { [error.campo]: mensajeDeError(t, error) }, general: null };
  return { campos: {}, general: mensajeDeError(t, error) };
}

export function enfocarPrimerError(formulario: HTMLFormElement | null): void {
  queueMicrotask(() => formulario?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export const idDeControl = (campo: string) => `calendario-${campo}`;
const idDeAyuda = (campo: string) => `calendario-${campo}-ayuda`;
const idDeError = (campo: string) => `calendario-${campo}-error`;

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
export function Campo(props: { campo: string; etiqueta: string; ayuda?: ComponentChildren; error?: string; children: ComponentChildren; clase?: string }) {
  return (
    <div class={props.clase ?? 'campo'}>
      <label for={idDeControl(props.campo)}>{props.etiqueta}</label>
      {props.children}
      {props.ayuda && (
        <span id={idDeAyuda(props.campo)} class="campo__ayuda">
          {props.ayuda}
        </span>
      )}
      <ErrorDeCampo campo={props.campo} error={props.error} />
    </div>
  );
}

export function Ayuda({ campo, children }: { campo: string; children: ComponentChildren }) {
  return (
    <span id={idDeAyuda(campo)} class="campo__ayuda">
      {children}
    </span>
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

// ---------------------------------------------------------------------------
// Fechas civiles para mostrar
// ---------------------------------------------------------------------------

const LOCALE = 'es-CO';
const enUtc = (fecha: string) => new Date(`${fecha}T12:00:00Z`); // mediodía UTC: la fecha civil no se corre
const fmtMesAnio = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'long', year: 'numeric' });
const fmtDiaLargo = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fmtDiaCorto = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const fmtDiaMes = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'short' });

export const fechas = {
  mesAnio: (f: string) => fmtMesAnio.format(enUtc(f)),
  diaLargo: (f: string) => fmtDiaLargo.format(enUtc(f)),
  diaCorto: (f: string) => fmtDiaCorto.format(enUtc(f)),
  diaMes: (f: string) => fmtDiaMes.format(enUtc(f)),
};

export const hoyCivil = (ctx: ContextoDeModulo) => zonaDelUsuario().aCivil(ctx.reloj.ahora().getTime()).fecha;

/** Hora para mostrar (instante UTC → hora de Bogotá). */
export const horaDe = (ctx: ContextoDeModulo, ms: number) => ctx.formatos.hora(new Date(ms));

// ---------------------------------------------------------------------------
// Ancho de pantalla (diseños angosto y ancho)
// ---------------------------------------------------------------------------

export const CONSULTA_ANCHO = '(min-width: 720px)';

export function useEsAncho(): boolean {
  const [ancho, setAncho] = useState(() => matchMedia(CONSULTA_ANCHO).matches);
  useEffect(() => {
    const m = matchMedia(CONSULTA_ANCHO);
    const cambiar = () => setAncho(m.matches);
    m.addEventListener('change', cambiar);
    return () => m.removeEventListener('change', cambiar);
  }, []);
  return ancho;
}

// ---------------------------------------------------------------------------
// Lectura de fuentes (tolerante a fallos) para un rango
// ---------------------------------------------------------------------------

export type EstadoDeVisibles =
  | { estado: 'cargando' }
  | { estado: 'error'; error: unknown; reintentar: () => void }
  | { estado: 'listo'; visibles: Visibles; hayEventosPropios: boolean; reintentar: () => void };

export function useVisibles(ctx: ContextoDeModulo, rango: Rango): EstadoDeVisibles {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [error, setError] = useState<unknown>(null);
  const reintentar = () => setVersion((v) => v + 1);

  useEffect(() => ctx.almacen.alCambiar(ALMACENES_DE_FUENTES, reintentar), [ctx.almacen]);
  useEffect(() => {
    let vigente = true;
    leerFuentes(ctx.almacen)
      .then((l) => {
        if (!vigente) return;
        // Si fallaron TODAS las fuentes, es un error de la pantalla; si no, se muestra lo que hay.
        if (l.fallos.length === ALMACENES_DE_FUENTES.length) setError(l.fallos[0]!.error);
        else {
          setError(null);
          setLectura(l);
        }
      })
      .catch((e: unknown) => vigente && setError(e));
    return () => {
      vigente = false;
    };
  }, [ctx.almacen, version]);

  const oculto = useOcultoPorDeshacer();
  const visibles = useMemo(() => {
    if (!lectura) return null;
    const v = visiblesEnRango(lectura, rango, zonaDelUsuario());
    // Lo que se está eliminando (con "Deshacer" pendiente) no se muestra.
    return oculto ? { ...v, elementos: v.elementos.filter((x) => x.fuente !== 'propio' || x.eventoId !== oculto) } : v;
  }, [lectura, rango.desdeMs, rango.hastaMs, oculto]);
  if (error) return { estado: 'error', error, reintentar };
  if (!lectura || !visibles) return { estado: 'cargando' };
  return { estado: 'listo', visibles, hayEventosPropios: (lectura.registros.get('propios')?.length ?? 0) > 0, reintentar };
}

export function AvisoDeFuentes({ ctx, visibles, reintentar }: { ctx: ContextoDeModulo; visibles: Visibles; reintentar: () => void }) {
  if (visibles.fallos.length === 0) return null;
  const fuentes = visibles.fallos
    .map((f) => {
      const nombre = ctx.t(`calendario.fuente.${f.fuente}`);
      return f.omitidos > 0 ? ctx.t('calendario.fuenteOmitidos', { fuente: nombre, n: f.omitidos }) : nombre;
    })
    .join(', ');
  return (
    <div class="aviso aviso--alerta fila" role="alert">
      <span>{ctx.t('calendario.fuenteFallo', { fuentes })}</span>
      <button type="button" class="boton" onClick={reintentar}>
        {ctx.t('calendario.reintentar')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Un elemento visible (propio o de otro módulo)
// ---------------------------------------------------------------------------

export const rutaDeVista = (vista: string, fecha: string) => `/calendario/ver/${vista}/${fecha}`;

/** Ruta del elemento: los propios abren su ocurrencia; los externos, su módulo (si lo publicó). */
export function rutaDe(x: ElementoVisible): string | null {
  if (x.fuente === 'propio') return `/calendario/eventos/${x.eventoId}/${x.clave}`;
  return x.ruta ?? null;
}

export function horarioDe(ctx: ContextoDeModulo, x: ElementoVisible): string {
  if (x.todoElDia) return ctx.t('calendario.todoElDia');
  if (x.puntual) return horaDe(ctx, x.inicioMs);
  return ctx.t('calendario.horario', { inicio: horaDe(ctx, x.inicioMs), fin: horaDe(ctx, x.finMs) });
}

/** Nombre del módulo de origen (sus textos están registrados globalmente). */
export const nombreDeOrigen = (ctx: ContextoDeModulo, origen: string) => ctx.t(`${origen}.nombre`);

/** Marcas que diferencian el elemento: repetición, modificada, compromiso, cumplido, externo. */
export function Marcas({ ctx, x }: { ctx: ContextoDeModulo; x: ElementoVisible }) {
  const t = ctx.t;
  const marcas: [string, string][] = [];
  if (x.fuente === 'propio') {
    if (x.recurrente) marcas.push(['↻', t('calendario.repite')]);
    if (x.modificada) marcas.push(['✎', t('calendario.modificada')]);
    if (x.compromiso) marcas.push([x.cumplida ? '★' : '☆', x.cumplida ? t('calendario.cumplido') : t('calendario.compromiso')]);
  } else {
    marcas.push(['🔒', t('calendario.soloLectura', { origen: nombreDeOrigen(ctx, x.origen) })]);
    if (x.hecho) marcas.push(['✓', t('calendario.hecho')]);
  }
  return (
    <>
      {marcas.map(([icono, texto]) => (
        <span key={texto} class="cal-marca" title={texto}>
          <span aria-hidden="true">{icono}</span>
          <span class="oculto-visualmente">{texto}</span>
        </span>
      ))}
    </>
  );
}

/** Fila de la agenda o de una lista. */
export function FilaDeElemento({ ctx, x }: { ctx: ContextoDeModulo; x: ElementoVisible }) {
  const ruta = rutaDe(x);
  const tachado = x.hecho || (x.fuente === 'propio' && x.cumplida);
  const titulo = <span class={tachado ? 'tachado' : undefined}>{x.titulo}</span>;
  return (
    <li class={x.fuente === 'externo' ? 'cal-fila cal-fila--externo' : 'cal-fila'} data-color={x.color}>
      <span class="cal-fila__hora texto-tenue">{horarioDe(ctx, x)}</span>
      <span class="cal-fila__titulo">
        <span class="marca-color" aria-hidden="true" />
        {ruta ? <a href={hrefDe(ruta)}>{titulo}</a> : titulo}
        <Marcas ctx={ctx} x={x} />
      </span>
      {x.fuente === 'propio' && x.lugar && <span class="cal-fila__lugar texto-tenue">{x.lugar}</span>}
      {x.fuente === 'externo' && <span class="cal-fila__lugar texto-tenue">{ctx.t('calendario.soloLectura', { origen: nombreDeOrigen(ctx, x.origen) })}</span>}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Permiso de notificaciones y garantías por plataforma (CA8)
// ---------------------------------------------------------------------------

export function GarantiasDeAviso({ ctx }: { ctx: ContextoDeModulo }) {
  const [permiso, setPermiso] = useState(() => ctx.notificaciones.permiso());
  const t = ctx.t;
  const claves = { concedido: 'concedido', denegado: 'denegado', 'no-soportado': 'noSoportado', preguntar: 'preguntar' } as const;
  return (
    <div class="pila cal-garantias">
      {permiso === 'preguntar' ? (
        <button type="button" class="boton" onClick={async () => setPermiso(await ctx.notificaciones.pedirPermiso())}>
          🔔 {t('calendario.permiso.preguntar')}
        </button>
      ) : (
        <p class={permiso === 'concedido' ? 'texto-tenue' : 'aviso aviso--alerta'}>{t(`calendario.permiso.${claves[permiso]}`)}</p>
      )}
      <details class="detalles">
        <summary>{t('calendario.garantias.titulo')}</summary>
        <ul class="cal-lista-simple">
          <li>{t('calendario.garantias.abierta')}</li>
          <li>{t('calendario.garantias.android')}</li>
          <li>{t('calendario.garantias.cerrada')}</li>
          <li>
            {t('calendario.garantias.alternativa')} <a href={hrefDe('/calendario/ics')}>{t('calendario.importarExportarNombre')}</a>
          </li>
        </ul>
      </details>
    </div>
  );
}
