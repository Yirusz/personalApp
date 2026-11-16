/** Piezas de UI compartidas por las pantallas del Calendario. */
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, ReferenciaDeEntidad, ResultadoDeFichas } from '../../../nucleo/contrato';
import { COLORES_CATEGORICOS } from '../../../nucleo/dominio/agenda';
import { esColorHex, hexDesdeHsv, hsvDesdeHex, type ColorDeAgenda, type ColorHex, type Hsv } from '../../../nucleo/dominio/color';
import type { Vinculo } from '../../../nucleo/dominio/fichas';
import { atributosDeColor } from '../../../ui/color';
import type { Traductor } from '../../../nucleo/i18n/traductor';
import { useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { ALMACENES_DE_FUENTES, combinar, leerFuentes, leerFuentesRegistradas, visiblesEnRango, type Lectura, type LecturaRegistrada, type Visibles } from '../aplicacion/fuentes';
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
const fmtHoraSola = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', hour: 'numeric' });
const fmtDiaSemana = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short' });

export const fechas = {
  mesAnio: (f: string) => fmtMesAnio.format(enUtc(f)),
  diaLargo: (f: string) => fmtDiaLargo.format(enUtc(f)),
  diaCorto: (f: string) => fmtDiaCorto.format(enUtc(f)),
  diaMes: (f: string) => fmtDiaMes.format(enUtc(f)),
  /** Etiqueta de la cuadrícula horaria: "7 a. m.". */
  horaSola: (h: number) => fmtHoraSola.format(new Date(Date.UTC(2000, 0, 1, h))),
  /** "lun", "mar"… (se muestra en mayúsculas, como Google). */
  diaSemana: (f: string) => fmtDiaSemana.format(enUtc(f)).replace('.', ''),
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
  const [registradas, setRegistradas] = useState<LecturaRegistrada | null>(null);
  const [error, setError] = useState<unknown>(null);
  const reintentar = () => setVersion((v) => v + 1);

  // Cambios en lo propio y en las fuentes de otros módulos.
  useEffect(() => {
    const dejar = [ctx.almacen.alCambiar(ALMACENES_DE_FUENTES, reintentar), ...ctx.integraciones.fuentesDeCalendario().map((f) => f.fuente.alCambiar(reintentar))];
    return () => dejar.forEach((d) => d());
  }, [ctx.almacen, ctx.integraciones]);

  useEffect(() => {
    let vigente = true;
    leerFuentes(ctx.almacen)
      .then((l) => {
        if (!vigente) return;
        // Si fallaron TODAS las fuentes locales, es un error de la pantalla; si no, se muestra lo que hay.
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

  useEffect(() => {
    let vigente = true;
    void leerFuentesRegistradas(ctx.integraciones, rango, zonaDelUsuario()).then((r) => vigente && setRegistradas(r));
    return () => {
      vigente = false;
    };
  }, [ctx.integraciones, rango.desdeMs, rango.hastaMs, version]);

  const oculto = useOcultoPorDeshacer();
  const visibles = useMemo(() => {
    if (!lectura || !registradas) return null;
    const v = combinar(visiblesEnRango(lectura, rango, zonaDelUsuario(), registradas.origenes), registradas);
    // Lo que se está eliminando (con "Deshacer" pendiente) no se muestra.
    return oculto ? { ...v, elementos: v.elementos.filter((x) => x.fuente !== 'propio' || x.eventoId !== oculto) } : v;
  }, [lectura, registradas, rango.desdeMs, rango.hastaMs, oculto]);
  if (error) return { estado: 'error', error, reintentar };
  if (!lectura || !visibles) return { estado: 'cargando' };
  return { estado: 'listo', visibles, hayEventosPropios: (lectura.registros.get('propios')?.length ?? 0) > 0, reintentar };
}

export function AvisoDeFuentes({ ctx, visibles, reintentar }: { ctx: ContextoDeModulo; visibles: Visibles; reintentar: () => void }) {
  if (visibles.fallos.length === 0) return null;
  const fuentes = visibles.fallos
    .map((f) => {
      const nombre = ctx.t(f.nombre);
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
    <li class={x.fuente === 'externo' ? 'cal-fila cal-fila--externo' : 'cal-fila'} {...atributosDeColor(x.color)}>
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

// ---------------------------------------------------------------------------
// Color: paleta + hex libre (H1, ADR-0015)
// ---------------------------------------------------------------------------

/** Muestras rápidas del color libre (además de la paleta). Nombres propios, valores propios. */
const MUESTRAS: readonly [string, ColorHex][] = [
  ['tomate', '#d32f2f'],
  ['coral', '#ff7043'],
  ['mandarina', '#f57c00'],
  ['mostaza', '#f9a825'],
  ['menta', '#26a69a'],
  ['bosque', '#1b5e20'],
  ['cielo', '#039be5'],
  ['indigo', '#3949ab'],
  ['lavanda', '#9575cd'],
  ['uva', '#7b1fa2'],
  ['cacao', '#6d4c41'],
  ['pizarra', '#455a64'],
];

/** Paleta y "otro color": al elegirlo se despliega el selector en la misma página (sin ventanas emergentes). */
export function SelectorDeColor({ ctx, nombre, valor, cambiar, error }: { ctx: ContextoDeModulo; nombre: string; valor: ColorDeAgenda; cambiar: (c: ColorDeAgenda) => void; error?: string }) {
  const t = ctx.t;
  const hex = esColorHex(valor);
  const [ultimoHex, setUltimoHex] = useState<ColorHex>(hex ? valor : '#ff7043');
  const elegirHex = (h: ColorHex) => {
    setUltimoHex(h);
    cambiar(h);
  };
  return (
    <fieldset class="grupo pila" aria-describedby={error ? `calendario-${nombre}-error` : undefined}>
      <legend>{t('calendario.campo.color')}</legend>
      <div class="grupo--en-linea">
        {COLORES_CATEGORICOS.map((c) => (
          <label key={c} class="opcion" data-color={c}>
            <input type="radio" name={`calendario-${nombre}`} checked={valor === c} onChange={() => cambiar(c)} />
            <span class="marca-color" aria-hidden="true" />
            {t(`calendario.color.${c}`)}
          </label>
        ))}
        <label class="opcion" {...atributosDeColor(ultimoHex)}>
          <input type="radio" name={`calendario-${nombre}`} checked={hex} aria-expanded={hex} onChange={() => cambiar(ultimoHex)} />
          <span class="marca-color" aria-hidden="true" />
          {t('calendario.color.otro')}
        </label>
      </div>
      {hex && <SelectorDeColorLibre ctx={ctx} nombre={nombre} valor={valor} cambiar={elegirHex} />}
      <ErrorDeCampo campo={nombre} error={error} />
    </fieldset>
  );
}

const PATRON_HEX_ESCRITO = /^#?([0-9a-f]{6})$/i;

function SelectorDeColorLibre({ ctx, nombre, valor, cambiar }: { ctx: ContextoDeModulo; nombre: string; valor: ColorHex; cambiar: (h: ColorHex) => void }) {
  const t = ctx.t;
  // Se guarda el HSV además del hex: así el tono no se pierde al pasar por blanco, gris o negro.
  const [hsv, setHsv] = useState<Hsv>(() => hsvDesdeHex(valor));
  const [texto, setTexto] = useState<string>(valor);
  const [hexInvalido, setHexInvalido] = useState(false);
  const actual = useRef(hsv);
  actual.current = hsv;
  useEffect(() => {
    if (hexDesdeHsv(actual.current) !== valor) setHsv(hsvDesdeHex(valor));
    setTexto(valor);
    setHexInvalido(false);
  }, [valor]);

  const aplicar = (n: Hsv) => {
    const limpio = { h: Math.round(n.h), s: Math.round(Math.min(100, Math.max(0, n.s))), v: Math.round(Math.min(100, Math.max(0, n.v))) };
    setHsv(limpio);
    actual.current = limpio;
    cambiar(hexDesdeHsv(limpio));
  };
  const desdePuntero = (e: PointerEvent) => {
    const caja = (e.currentTarget as HTMLElement).getBoundingClientRect();
    aplicar({ ...actual.current, s: ((e.clientX - caja.left) / caja.width) * 100, v: 100 - ((e.clientY - caja.top) / caja.height) * 100 });
  };
  const alTeclear = (e: KeyboardEvent) => {
    const paso = e.shiftKey ? 10 : 1;
    const h = actual.current;
    const mapa: Record<string, Partial<Hsv>> = { ArrowLeft: { s: h.s - paso }, ArrowRight: { s: h.s + paso }, ArrowUp: { v: h.v + paso }, ArrowDown: { v: h.v - paso } };
    const cambio = mapa[e.key];
    if (!cambio) return;
    e.preventDefault();
    aplicar({ ...h, ...cambio });
  };

  return (
    <div class="cal-color-libre" {...atributosDeColor(valor)}>
      <div
        class="cal-color-libre__area"
        style={{ '--tono': hsv.h, '--s': hsv.s, '--v': hsv.v }}
        role="slider"
        tabIndex={0}
        aria-label={t('calendario.color.area')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hsv.s}
        aria-valuetext={t('calendario.color.areaValor', { s: hsv.s, v: hsv.v })}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          desdePuntero(e);
        }}
        onPointerMove={(e) => (e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId) && desdePuntero(e)}
        onKeyDown={alTeclear}
      >
        <span class="cal-color-libre__cursor" aria-hidden="true" />
      </div>
      <label class="cal-color-libre__etiqueta" for={`calendario-${nombre}-tono`}>
        {t('calendario.color.tono')}
      </label>
      <input
        id={`calendario-${nombre}-tono`}
        class="cal-color-libre__tono"
        type="range"
        min={0}
        max={359}
        value={hsv.h}
        aria-valuetext={t('calendario.color.tonoValor', { n: hsv.h })}
        onInput={(e) => aplicar({ ...actual.current, h: Number((e.currentTarget as HTMLInputElement).value) })}
      />
      <div class="cal-color-libre__fila">
        <div class="campo">
          <label for={`calendario-${nombre}-hex`}>{t('calendario.color.hex')}</label>
          <input
            id={`calendario-${nombre}-hex`}
            class="cal-color-libre__hex"
            value={texto}
            maxLength={7}
            spellcheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-invalid={hexInvalido ? 'true' : undefined}
            aria-describedby={hexInvalido ? `calendario-${nombre}-hex-error` : undefined}
            onInput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value.trim();
              setTexto(v);
              const m = PATRON_HEX_ESCRITO.exec(v);
              setHexInvalido(false);
              if (m) cambiar(`#${m[1]!.toLowerCase()}` as ColorHex);
            }}
            onBlur={() => setHexInvalido(!PATRON_HEX_ESCRITO.test(texto))}
          />
          {hexInvalido && (
            <span id={`calendario-${nombre}-hex-error`} class="campo__error">
              {t('calendario.color.hexInvalido')}
            </span>
          )}
        </div>
        <span class="cal-color-libre__muestra" aria-hidden="true">
          {t('calendario.color.ejemplo')}
        </span>
      </div>
      <div class="cal-color-libre__muestras" role="group" aria-label={t('calendario.color.rapidos')}>
        {MUESTRAS.map(([n, h]) => (
          <button key={h} type="button" class="cal-color-libre__rapido" style={{ background: h }} aria-pressed={valor === h} aria-label={t(`calendario.color.muestra.${n}`)} title={t(`calendario.color.muestra.${n}`)} onClick={() => cambiar(h)} />
        ))}
      </div>
      <p class="campo__ayuda">{t('calendario.color.otroAyuda', { hex: valor })}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fichas y referencias de otros módulos (H8, H9)
// ---------------------------------------------------------------------------

export function useFichas(ctx: ContextoDeModulo): ResultadoDeFichas | null {
  const [r, setR] = useState<ResultadoDeFichas | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => ctx.integraciones.alCambiarFichas(() => setVersion((v) => v + 1)), [ctx.integraciones]);
  useEffect(() => {
    let vigente = true;
    void ctx.integraciones.fichas().then((x) => vigente && setR(x));
    return () => {
      vigente = false;
    };
  }, [ctx.integraciones, version]);
  return r;
}

/** Entidades activas de otros módulos para vincular un evento (materias, trabajos…). */
export function useReferencias(ctx: ContextoDeModulo, vinculo: Vinculo | null): ReferenciaDeEntidad[] | null {
  const [lista, setLista] = useState<ReferenciaDeEntidad[] | null>(null);
  useEffect(() => {
    let vigente = true;
    void Promise.all([
      ctx.integraciones.buscarReferencias({ limite: 200 }),
      vinculo ? ctx.integraciones.buscarReferencias({ tipo: vinculo.tipo, ids: [vinculo.id], incluirInactivas: true }) : Promise.resolve({ referencias: [] as ReferenciaDeEntidad[] }),
    ]).then(([activas, actual]) => {
      if (!vigente) return;
      const todas = [...actual.referencias, ...activas.referencias];
      setLista(todas.filter((r, i) => todas.findIndex((x) => x.tipo === r.tipo && x.id === r.id) === i));
    });
    return () => {
      vigente = false;
    };
  }, [ctx.integraciones, vinculo?.tipo, vinculo?.id]);
  return lista;
}

export const claveDeVinculo = (v: Vinculo) => `${v.tipo}|${v.id}`;
export const vinculoDeClave = (k: string): Vinculo | null => {
  const i = k.indexOf('|');
  return i > 0 ? { tipo: k.slice(0, i), id: k.slice(i + 1) } : null;
};

/** "Vinculado a: Cálculo II" con enlace al módulo dueño (o "ya no existe"). */
export function LineaDeVinculo({ ctx, vinculo }: { ctx: ContextoDeModulo; vinculo: Vinculo }) {
  const [ref, setRef] = useState<ReferenciaDeEntidad | null | undefined>(undefined);
  useEffect(() => {
    let vigente = true;
    void ctx.integraciones.buscarReferencias({ tipo: vinculo.tipo, ids: [vinculo.id], incluirInactivas: true }).then((r) => vigente && setRef(r.referencias[0] ?? null));
    return () => {
      vigente = false;
    };
  }, [vinculo.tipo, vinculo.id]);
  if (ref === undefined) return null;
  return (
    <p class="texto-tenue">
      {ctx.t('calendario.vinculadoA')}{' '}
      {ref ? (
        <>
          {ref.ruta ? <a href={hrefDe(ref.ruta)}>{ref.titulo}</a> : <strong>{ref.titulo}</strong>}
          {ref.detalle && ` · ${ref.detalle}`}
          {!ref.activa && ` (${ctx.t('calendario.vinculoInactivo')})`}
        </>
      ) : (
        ctx.t('calendario.vinculoPerdido')
      )}
    </p>
  );
}
