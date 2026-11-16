/**
 * Vistas agenda, día, semana y mes al estilo de Google Calendar (H3, H7), con lo propio y
 * lo de otros módulos (H4), y la barra lateral de fichas: se arrastran a la vista (mouse o
 * dedo) o se tocan y luego se toca un hueco (H8, ADR-0015).
 * Ruta: /calendario/ver/:vista/:fecha. ← → cambian de periodo, T = hoy, N = nuevo
 * evento, Esc suelta la ficha; en el mes, las flechas recorren los días (cuadrícula ARIA).
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type { ContextoDeModulo, PropsDeVista } from "../../../nucleo/contrato";
import type { FichaDeCalendario } from "../../../nucleo/dominio/fichas";
import { esFechaCivil } from "../../../nucleo/dominio/zona-horaria";
import { atributosDeColor } from "../../../ui/color";
import { Cargando, ErrorConReintento, Vacio } from "../../../ui/componentes";
import { ofrecerDeshacer } from "../../../ui/deshacer";
import { hrefDe } from "../../../ui/enrutador";
import { crearSenal, useSenal } from "../../../ui/senal";
import { zonaDelUsuario } from "../aplicacion/comun";
import { eliminarEvento } from "../aplicacion/eventos";
import { colocarFicha } from "../aplicacion/fichas";
import {
  agruparPorDia,
  columnasDelDia,
  cuadriculaDeMes,
  rangoDeDias,
} from "../dominio/distribucion";
import { claveDeFicha, horaDeHueco } from "../dominio/ficha";
import {
  componentes,
  diaSemana,
  fechaConDia,
  inicioDeSemana,
  mismoMes,
  semanaIso,
  sumarDias,
  sumarMeses,
} from "../dominio/fechas";
import type { ElementoVisible } from "../dominio/visible";
import {
  guardarPanelDeFichas,
  guardarVista,
  leerPanelDeFichas,
  leerVista,
  VISTAS,
  type Vista,
} from "../infraestructura/preferencias";
import { BotonSemana } from "./BotonSemana";
import {
  AvisoDeFuentes,
  fechas,
  FilaDeElemento,
  hoyCivil,
  horaDe,
  horarioDe,
  LineaDeAviso,
  Marcas,
  mensajeDeError,
  rutaDe,
  rutaDeVista,
  useEsAncho,
  useFichas,
  useVisibles,
  type Aviso,
} from "./comun";

const DIAS_AGENDA = 14;
const MINUTOS_DIA = 1440;

/** Ficha elegida en la barra: al tocar un hueco se pone; al tocar algo que ella creó, se quita. */
interface FichaActiva {
  modulo: string;
  ficha: FichaDeCalendario;
  clave: string;
}

type Destino =
  | { tipo: "hora"; fecha: string; minuto: number }
  | { tipo: "dia"; fecha: string };

interface Arrastre {
  ficha: FichaActiva;
  x: number;
  y: number;
  destino: Destino | null;
}

// Estado compartido entre vistas y pantallas del calendario (sobrevive a cambiar de semana o de vista).
const fichaActiva = crearSenal<FichaActiva | null>(null);
const arrastre = crearSenal<Arrastre | null>(null);

function rangoDe(vista: Vista, fecha: string): { desde: string; dias: number } {
  if (vista === "agenda") return { desde: fecha, dias: DIAS_AGENDA };
  if (vista === "dia") return { desde: fecha, dias: 1 };
  if (vista === "semana") return { desde: inicioDeSemana(fecha), dias: 7 };
  const dias = cuadriculaDeMes(fecha);
  return { desde: dias[0]!, dias: dias.length };
}

function mover(vista: Vista, fecha: string, paso: number): string {
  if (vista === "agenda") return sumarDias(fecha, paso * 7);
  if (vista === "dia") return sumarDias(fecha, paso);
  if (vista === "semana") return sumarDias(fecha, paso * 7);
  const { anio, mes, dia } = componentes(fecha);
  const m = sumarMeses(anio, mes, paso);
  return fechaConDia(m.anio, m.mes, dia) ?? fechaConDia(m.anio, m.mes, 1)!;
}

function enCampo(destino: EventTarget | null): boolean {
  return (
    destino instanceof HTMLElement &&
    destino.closest(
      'input, textarea, select, [contenteditable], [role="grid"], [role="slider"]',
    ) !== null
  );
}

/** Hueco (día y minuto) o día del mes bajo el puntero, según los `data-soltar` de las vistas. */
function destinoEn(x: number, y: number): Destino | null {
  const el = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-soltar]");
  const fecha = el?.dataset.fecha;
  if (!el || !fecha) return null;
  if (el.dataset.soltar === "dia") return { tipo: "dia", fecha };
  const caja = el.getBoundingClientRect();
  return {
    tipo: "hora",
    fecha,
    minuto: horaDeHueco(
      Math.max(
        0,
        Math.min(MINUTOS_DIA - 1, ((y - caja.top) / caja.height) * MINUTOS_DIA),
      ),
    ),
  };
}

export function VistaCalendario({ ctx, params }: PropsDeVista) {
  const { t } = ctx;
  const hoy = hoyCivil(ctx);
  const vista: Vista = VISTAS.includes(params.vista as Vista)
    ? (params.vista as Vista)
    : leerVista();
  const fecha = params.fecha && esFechaCivil(params.fecha) ? params.fecha : hoy;
  const esAncho = useEsAncho();
  const { desde, dias } = rangoDe(vista, fecha);
  const rango = useMemo(
    () => rangoDeDias(desde, dias, zonaDelUsuario()),
    [desde, dias],
  );
  const estado = useVisibles(ctx, rango);

  const [panel, setPanel] = useState(leerPanelDeFichas);
  const activa = useSenal(fichaActiva);
  const enArrastre = useSenal(arrastre);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const conFichas = vista !== "agenda";
  const fichaEnUso = conFichas && panel ? activa : null;

  const ir = (v: Vista, f: string, reemplazar = true) => {
    guardarVista(v);
    ctx.navegar(rutaDeVista(v, f), { reemplazar });
  };

  const alternarPanel = () => {
    guardarPanelDeFichas(!panel);
    setPanel(!panel);
    fichaActiva.fijar(null);
  };

  /** Pone la ficha en ese día y minuto (media hora hacia abajo); se deshace en 10 s. */
  const colocar = async (f: FichaActiva, dia: string, minuto: number) => {
    setAviso(null);
    try {
      const inicio = zonaDelUsuario().aUtc(dia, horaDeHueco(minuto));
      const ev = await colocarFicha(ctx, f.modulo, f.ficha, inicio);
      const cuando = `${fechas.diaLargo(dia)}, ${ctx.formatos.hora(new Date(inicio))}`;
      await ofrecerDeshacer({
        mensaje: t(
          f.ficha.repeticion.tipo === "semanal"
            ? "calendario.fichas.puestaSemanal"
            : "calendario.fichas.puesta",
          {
            titulo: f.ficha.titulo,
            cuando,
            n:
              f.ficha.repeticion.tipo === "semanal"
                ? f.ficha.repeticion.semanas
                : 1,
          },
        ),
        deshacer: () => eliminarEvento(ctx, ev.id),
      });
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    }
  };

  /** En el mes no hay horas: soltar (o tocar con una ficha activa) abre ese día para elegir la hora. */
  const elegirHoraDe = (f: FichaActiva, dia: string) => {
    fichaActiva.fijar(f);
    ir("dia", dia, false);
    setAviso({
      ok: true,
      texto: t("calendario.fichas.elegirHora", { titulo: f.ficha.titulo }),
    });
  };

  const soltar = (f: FichaActiva, d: Destino) => {
    if (d.tipo === "hora") void colocar(f, d.fecha, d.minuto);
    else elegirHoraDe(f, d.fecha);
  };

  const quitar = (x: ElementoVisible) => {
    if (x.fuente !== "propio") return;
    void ofrecerDeshacer({
      mensaje: t(
        x.recurrente
          ? "calendario.fichas.quitadaSerie"
          : "calendario.fichas.quitada",
        { titulo: x.titulo },
      ),
      ocultar: x.eventoId,
      confirmar: () => eliminarEvento(ctx, x.eventoId),
    });
  };

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enCampo(e.target)) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        ir(vista, mover(vista, fecha, e.key === "ArrowLeft" ? -1 : 1));
      } else if (e.key === "Escape") fichaActiva.fijar(null);
      else if (e.key === "t" || e.key === "T") ir(vista, hoy);
      else if (e.key === "n" || e.key === "N")
        ctx.navegar(
          vista === "dia" ? `/calendario/nuevo/${fecha}` : "/calendario/nuevo",
        );
    };
    addEventListener("keydown", alTeclear);
    return () => removeEventListener("keydown", alTeclear);
  }, [vista, fecha, hoy]);

  const nuevo =
    vista === "dia" ? `/calendario/nuevo/${fecha}` : "/calendario/nuevo";

  const titulo =
    vista === "mes"
      ? fechas.mesAnio(fecha)
      : vista === "dia"
        ? fechas.diaLargo(fecha)
        : vista === "semana"
          ? t("calendario.semanaDe", {
              n: Number(semanaIso(fecha).slice(6)),
              desde: fechas.diaMes(desde),
              hasta: fechas.diaMes(sumarDias(desde, 6)),
            })
          : t("calendario.agendaDesde", {
              desde: fechas.diaMes(desde),
              hasta: fechas.diaMes(sumarDias(desde, dias - 1)),
            });

  const contenido =
    estado.estado === "cargando" ? (
      <Cargando />
    ) : estado.estado === "error" ? (
      <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
    ) : (
      <>
        <AvisoDeFuentes
          ctx={ctx}
          visibles={estado.visibles}
          reintentar={estado.reintentar}
        />
        {vista === "semana" && semanaIso(fecha) === semanaIso(hoy) && (
          <BotonSemana ctx={ctx} />
        )}
        {/* Día, semana y mes se dibujan SIEMPRE, aunque no haya nada (como Google Calendar). */}
        {vista === "agenda" ? (
          !estado.hayEventosPropios &&
          estado.visibles.elementos.length === 0 ? (
            <div class="pila">
              <Vacio>{t("calendario.sinEventos")}</Vacio>
              <div class="acciones">
                <a
                  class="boton boton--primario"
                  href={hrefDe("/calendario/nuevo")}
                >
                  {t("calendario.nuevoEvento")}
                </a>
                <a class="boton" href={hrefDe("/calendario/ics")}>
                  {t("calendario.importarExportarNombre")}
                </a>
              </div>
            </div>
          ) : (
            <Agenda
              ctx={ctx}
              elementos={estado.visibles.elementos}
              desde={desde}
              dias={dias}
              hoy={hoy}
            />
          )
        ) : vista === "mes" ? (
          <Mes
            ctx={ctx}
            elementos={estado.visibles.elementos}
            fecha={fecha}
            hoy={hoy}
            esAncho={esAncho}
            ir={ir}
            destino={enArrastre?.destino ?? null}
            ficha={fichaEnUso}
            alElegirConFicha={(f) => fichaEnUso && elegirHoraDe(fichaEnUso, f)}
          />
        ) : (
          <Cuadricula
            ctx={ctx}
            elementos={estado.visibles.elementos}
            fechasVisibles={
              vista === "dia"
                ? [fecha]
                : Array.from({ length: 7 }, (_, i) => sumarDias(desde, i))
            }
            hoy={hoy}
            esAncho={esAncho}
            alElegirDia={(f) => ir("dia", f, false)}
            ficha={fichaEnUso}
            arrastre={enArrastre}
            alColocar={(dia, minuto) =>
              fichaEnUso && void colocar(fichaEnUso, dia, minuto)
            }
            alQuitar={quitar}
          />
        )}
      </>
    );

  return (
    <div class="pila cal">
      <div class="cal-cabecera">
        <div class="cal-periodo">
          <button
            type="button"
            class="boton"
            aria-keyshortcuts="T"
            onClick={() => ir(vista, hoy)}
            disabled={fecha === hoy}
          >
            {t("calendario.hoy")}
          </button>
          <button
            type="button"
            class="boton cal-icono"
            aria-label={t("calendario.anterior")}
            onClick={() => ir(vista, mover(vista, fecha, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            class="boton cal-icono"
            aria-label={t("calendario.siguiente")}
            onClick={() => ir(vista, mover(vista, fecha, 1))}
          >
            ›
          </button>
          <h2 class="cal-titulo" aria-live="polite">
            {titulo}
          </h2>
          {conFichas && (
            <button
              type="button"
              class="boton cal-boton-fichas"
              aria-pressed={panel}
              aria-controls="cal-fichas"
              aria-label={t("calendario.fichas.boton")}
              onClick={alternarPanel}
            >
              <span aria-hidden="true">▦</span>
              <span class="cal-solo-ancho">
                {" "}
                {t("calendario.fichas.boton")}
              </span>
            </button>
          )}
          <a
            class="boton"
            href={hrefDe("/calendario/ics")}
            aria-label={t("calendario.importarExportarNombre")}
          >
            {t("calendario.importarExportar")}
          </a>
        </div>
        <div class="cal-herramientas">
          <nav class="cal-segmentos" aria-label={t("calendario.vistas")}>
            {VISTAS.map((v) => (
              <a
                key={v}
                href={hrefDe(rutaDeVista(v, fecha))}
                class="cal-segmentos__opcion"
                aria-current={v === vista ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  ir(v, fecha);
                }}
              >
                {t(`calendario.vista.${v}`)}
              </a>
            ))}
          </nav>
          <a
            class="boton boton--primario cal-solo-ancho"
            href={hrefDe(nuevo)}
            aria-keyshortcuts="N"
          >
            + {t("calendario.nuevoEvento")}
          </a>
        </div>
        <p class="texto-tenue cal-atajos">
          {t(vista === "mes" ? "calendario.atajosMes" : "calendario.atajos")}
        </p>
      </div>

      <LineaDeAviso aviso={aviso} />

      <div
        class={
          conFichas && panel
            ? "cal-cuerpo cal-cuerpo--con-fichas"
            : "cal-cuerpo"
        }
      >
        {conFichas && panel && (
          <BarraDeFichas
            ctx={ctx}
            vista={vista}
            activa={activa}
            alSoltar={soltar}
          />
        )}
        <div class="cal-vista">{contenido}</div>
      </div>

      {enArrastre && (
        <div
          class="cal-fantasma"
          style={{ left: `${enArrastre.x}px`, top: `${enArrastre.y}px` }}
          {...atributosDeColor(enArrastre.ficha.ficha.color)}
          aria-hidden="true"
        >
          {enArrastre.ficha.ficha.titulo}
        </div>
      )}

      <a
        class="cal-fab"
        href={hrefDe(nuevo)}
        aria-label={t("calendario.nuevoEvento")}
      >
        +
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

function Agenda({
  ctx,
  elementos,
  desde,
  dias,
  hoy,
}: {
  ctx: ContextoDeModulo;
  elementos: ElementoVisible[];
  desde: string;
  dias: number;
  hoy: string;
}) {
  const grupos = agruparPorDia(elementos, desde, dias, zonaDelUsuario()).filter(
    (d) => d.todoElDia.length + d.conHora.length > 0,
  );
  if (grupos.length === 0)
    return <Vacio>{ctx.t("calendario.vacioPeriodo")}</Vacio>;
  return (
    <div class="pila">
      {grupos.map((d) => (
        <section
          key={d.fecha}
          class="cal-dia-agenda"
          aria-labelledby={`cal-agenda-${d.fecha}`}
        >
          <h3
            id={`cal-agenda-${d.fecha}`}
            class={
              d.fecha === hoy
                ? "cal-dia-agenda__titulo cal-hoy"
                : "cal-dia-agenda__titulo"
            }
          >
            {d.fecha === hoy ? `${ctx.t("calendario.hoy")} · ` : ""}
            {fechas.diaLargo(d.fecha)}
          </h3>
          <ul class="cal-lista">
            {[...d.todoElDia, ...d.conHora].map((x) => (
              <FilaDeElemento key={x.id} ctx={ctx} x={x} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Día y semana: las 24 horas, como Google Calendar
// ---------------------------------------------------------------------------

const HORAS = Array.from({ length: 24 }, (_, h) => h);
const HORA_INICIAL_VISIBLE = 7;
/** Arrastre mínimo (min) para que cuente como rango y no como toque. */
const ARRASTRE_MINIMO = 30;

const dosDigitos = (n: number) => String(n).padStart(2, "0");
const local = (fecha: string, minutos: number) =>
  `${fecha}T${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;

function minutoEn(e: MouseEvent, columna: HTMLElement): number {
  const caja = columna.getBoundingClientRect();
  return Math.max(
    0,
    Math.min(
      MINUTOS_DIA - 1,
      ((e.clientY - caja.top) / caja.height) * MINUTOS_DIA,
    ),
  );
}

/** Re-renderiza cada minuto (línea de "ahora"), solo mientras la vista está montada. */
function useMinuto(ctx: ContextoDeModulo): number {
  const [ahora, setAhora] = useState(() => ctx.reloj.ahora().getTime());
  useEffect(() => {
    const id = setInterval(() => setAhora(ctx.reloj.ahora().getTime()), 60_000);
    return () => clearInterval(id);
  }, [ctx.reloj]);
  return ahora;
}

interface Seleccion {
  fecha: string;
  desde: number;
  hasta: number;
}

/** Encabezado de un día como en Google: "LUN" pequeño y el número grande (hoy, en círculo). */
function EncabezadoDeDia({
  f,
  hoy,
  alElegir,
}: {
  ctx: ContextoDeModulo;
  f: string;
  hoy: string;
  alElegir?: () => void;
}) {
  const contenido = (
    <>
      <span class="cal-col-titulo__dia" aria-hidden="true">
        {fechas.diaSemana(f)}
      </span>
      <span class="cal-col-titulo__numero" aria-hidden="true">
        {Number(f.slice(8))}
      </span>
    </>
  );
  const clase = f === hoy ? "cal-col-titulo cal-hoy" : "cal-col-titulo";
  return alElegir ? (
    <button
      type="button"
      class={clase}
      aria-label={fechas.diaLargo(f)}
      aria-current={f === hoy ? "date" : undefined}
      onClick={alElegir}
    >
      {contenido}
    </button>
  ) : (
    <span
      class={clase}
      role="heading"
      aria-level={3}
      aria-label={fechas.diaLargo(f)}
    >
      {contenido}
    </span>
  );
}

function Cuadricula({
  ctx,
  elementos,
  fechasVisibles,
  hoy,
  esAncho,
  alElegirDia,
  ficha,
  arrastre: enArrastre,
  alColocar,
  alQuitar,
}: {
  ctx: ContextoDeModulo;
  elementos: ElementoVisible[];
  fechasVisibles: string[];
  hoy: string;
  esAncho: boolean;
  alElegirDia: (fecha: string) => void;
  ficha: FichaActiva | null;
  arrastre: Arrastre | null;
  alColocar: (fecha: string, minuto: number) => void;
  alQuitar: (x: ElementoVisible) => void;
}) {
  const zona = zonaDelUsuario();
  const desplazable = useRef<HTMLDivElement>(null);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const arrastro = useRef(false);
  const grupos = agruparPorDia(
    elementos,
    fechasVisibles[0]!,
    fechasVisibles.length,
    zona,
  );
  const porFecha = new Map(grupos.map((g) => [g.fecha, g]));
  const civilAhora = zona.aCivil(useMinuto(ctx));
  const semana = fechasVisibles.length > 1;
  const previa =
    enArrastre?.destino?.tipo === "hora" ? enArrastre.destino : null;

  // Al entrar: si hoy está a la vista, una hora antes de ahora; si no, las 7:00 o lo primero
  // que haya ese día/semana si empieza antes (para no dejar un evento cortado arriba).
  const primeraHora = Math.min(
    HORA_INICIAL_VISIBLE,
    ...fechasVisibles.flatMap((f) =>
      columnasDelDia(porFecha.get(f)?.conHora ?? [], f, zona).map((p) =>
        Math.floor(p.desdeMinuto / 60),
      ),
    ),
  );
  useLayoutEffect(() => {
    const d = desplazable.current;
    const hora = fechasVisibles.includes(civilAhora.fecha)
      ? Math.max(0, Math.floor(civilAhora.minutos / 60) - 1)
      : primeraHora;
    const fila = d?.querySelector<HTMLElement>(`[data-hora="${hora}"]`);
    // El contenedor es `position: relative`: offsetTop de la fila ya es relativo a él.
    if (d && fila) d.scrollTop = fila.offsetTop;
  }, [fechasVisibles[0], fechasVisibles.length, primeraHora]);

  // Al arrastrar una ficha cerca del borde de la cuadrícula, se desplaza sola.
  // Solo si el puntero se queda medio segundo en el borde: al entrar a la cuadrícula
  // desde arriba no debe correrse la hora en la que se piensa soltar.
  const hayArrastre = enArrastre !== null;
  useEffect(() => {
    if (!hayArrastre) return;
    let ticksEnBorde = 0;
    const id = setInterval(() => {
      const d = desplazable.current;
      const a = arrastre.valor();
      if (!d || !a) return;
      const caja = d.getBoundingClientRect();
      const dentro = a.x >= caja.left && a.x <= caja.right;
      const arriba = dentro && a.y < caja.top + 40 && a.y > caja.top - 60;
      const abajo = dentro && a.y > caja.bottom - 40 && a.y < caja.bottom + 60;
      if (!arriba && !abajo) {
        ticksEnBorde = 0;
        return;
      }
      // 12 × 40 ms ≈ medio segundo quieto en el borde.
      if (++ticksEnBorde < 12) return;
      d.scrollTop += arriba ? -16 : 16;
    }, 40);
    return () => clearInterval(id);
  }, [hayArrastre]);

  /** Toque o clic en un hueco: pone la ficha activa, o abre "nuevo evento" en esa media hora. */
  const alTocar = (fecha: string, e: MouseEvent) => {
    if (e.target !== e.currentTarget) return; // clic en un evento: lo maneja el bloque
    if (arrastro.current) {
      arrastro.current = false;
      return;
    }
    const minuto = minutoEn(e, e.currentTarget as HTMLElement);
    if (ficha) alColocar(fecha, minuto);
    else ctx.navegar(`/calendario/nuevo/${local(fecha, horaDeHueco(minuto))}`);
  };

  // Escritorio: arrastrar con el mouse sobre un día marca el rango del evento nuevo.
  const alPresionar = (fecha: string, e: PointerEvent) => {
    if (
      e.pointerType !== "mouse" ||
      e.button !== 0 ||
      e.target !== e.currentTarget ||
      ficha
    )
      return;
    const m = horaDeHueco(minutoEn(e, e.currentTarget as HTMLElement));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSeleccion({ fecha, desde: m, hasta: m + 30 });
  };
  const alMover = (e: PointerEvent) => {
    if (!seleccion) return;
    const fin = Math.min(
      MINUTOS_DIA,
      Math.ceil(minutoEn(e, e.currentTarget as HTMLElement) / 15) * 15,
    );
    setSeleccion({ ...seleccion, hasta: Math.max(seleccion.desde + 15, fin) });
  };
  const alSoltarSeleccion = () => {
    if (!seleccion) return;
    const { fecha, desde, hasta } = seleccion;
    setSeleccion(null);
    if (hasta - desde > ARRASTRE_MINIMO) {
      arrastro.current = true;
      ctx.navegar(
        `/calendario/nuevo/${local(fecha, desde)}/${hasta >= MINUTOS_DIA ? local(sumarDias(fecha, 1), 0) : local(fecha, hasta)}`,
      );
    }
  };

  const hayTodoElDia = fechasVisibles.some(
    (f) => (porFecha.get(f)?.todoElDia.length ?? 0) > 0,
  );

  return (
    <div
      class={
        semana
          ? "cal-rejilla cal-rejilla--semana"
          : "cal-rejilla cal-rejilla--dia"
      }
      style={{ "--cal-columnas": fechasVisibles.length }}
    >
      <div class="cal-rejilla__encabezado">
        <span class="cal-rejilla__zona texto-tenue" aria-hidden="true">
          GMT-5
        </span>
        {fechasVisibles.map((f) => (
          <EncabezadoDeDia
            key={f}
            ctx={ctx}
            f={f}
            hoy={hoy}
            alElegir={semana ? () => alElegirDia(f) : undefined}
          />
        ))}
      </div>
      <div
        class={
          hayTodoElDia
            ? "cal-rejilla__todo-el-dia"
            : "cal-rejilla__todo-el-dia cal-rejilla__todo-el-dia--vacio"
        }
      >
        <span class="texto-tenue cal-rejilla__etiqueta">
          {ctx.t("calendario.todoElDia")}
        </span>
        {fechasVisibles.map((f) => (
          <ul
            key={f}
            class="cal-lista-compacta"
            aria-label={`${ctx.t("calendario.todoElDia")}, ${fechas.diaLargo(f)}`}
          >
            {(porFecha.get(f)?.todoElDia ?? []).map((x) => (
              <li key={x.id}>
                <Bloque ctx={ctx} x={x} ficha={ficha} alQuitar={alQuitar} />
              </li>
            ))}
          </ul>
        ))}
      </div>
      <div class="cal-rejilla__horas" ref={desplazable}>
        <div class="cal-rejilla__etiquetas" aria-hidden="true">
          {HORAS.map((h) => (
            <span key={h} class="cal-hora" data-hora={h}>
              {h === 0 ? "" : fechas.horaSola(h)}
            </span>
          ))}
        </div>
        {fechasVisibles.map((f) => (
          <div
            key={f}
            class={`cal-columna${ficha ? " cal-columna--ficha" : ""}${f === hoy ? " cal-columna--hoy" : ""}`}
            data-soltar="hora"
            data-fecha={f}
            onClick={(e) => alTocar(f, e)}
            onPointerDown={(e) => alPresionar(f, e)}
            onPointerMove={alMover}
            onPointerUp={alSoltarSeleccion}
            onPointerCancel={() => setSeleccion(null)}
            aria-label={fechas.diaLargo(f)}
            role="list"
          >
            {columnasDelDia(porFecha.get(f)?.conHora ?? [], f, zona).map(
              (p) => (
                <div
                  key={p.elemento.id}
                  role="listitem"
                  class="cal-posicion"
                  style={{
                    "--desde": p.desdeMinuto,
                    "--hasta": Math.max(p.hastaMinuto, p.desdeMinuto + 30),
                    "--col": p.columna,
                    "--cols": p.columnas,
                  }}
                >
                  <Bloque
                    ctx={ctx}
                    x={p.elemento}
                    ficha={ficha}
                    alQuitar={alQuitar}
                    compacto={!esAncho && semana}
                  />
                </div>
              ),
            )}
            {seleccion?.fecha === f && (
              <div
                class="cal-seleccion"
                style={{
                  "--desde": seleccion.desde,
                  "--hasta": seleccion.hasta,
                }}
                aria-hidden="true"
              />
            )}
            {previa?.fecha === f && enArrastre && (
              <div
                class="cal-previa"
                style={{
                  "--desde": previa.minuto,
                  "--hasta": Math.min(
                    MINUTOS_DIA,
                    previa.minuto + enArrastre.ficha.ficha.duracionMin,
                  ),
                }}
                {...atributosDeColor(enArrastre.ficha.ficha.color)}
                aria-hidden="true"
              >
                <strong>{enArrastre.ficha.ficha.titulo}</strong>
                <span>{horaDe(ctx, zona.aUtc(f, previa.minuto))}</span>
              </div>
            )}
            {f === civilAhora.fecha && (
              <div
                class="cal-ahora"
                style={{ "--desde": civilAhora.minutos }}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Bloque({
  ctx,
  x,
  ficha,
  alQuitar,
  compacto = false,
}: {
  ctx: ContextoDeModulo;
  x: ElementoVisible;
  ficha?: FichaActiva | null;
  alQuitar?: (x: ElementoVisible) => void;
  compacto?: boolean;
}) {
  const ruta = rutaDe(x);
  // Con una ficha activa, lo que esa ficha creó se quita con un toque.
  const quitable = !!ficha && x.fuente === "propio" && x.ficha === ficha.clave;
  const clase = `cal-bloque${x.fuente === "externo" ? " cal-bloque--externo" : ""}${x.hecho || (x.fuente === "propio" && x.cumplida) ? " cal-bloque--hecho" : ""}${quitable ? " cal-bloque--quitable" : ""}`;
  const contenido = (
    <>
      <span class="cal-bloque__titulo">
        {quitable && <span aria-hidden="true">✕ </span>}
        {x.titulo}
      </span>
      {!x.todoElDia && !compacto && (
        <span class="cal-bloque__hora">{horarioDe(ctx, x)}</span>
      )}
      {compacto ? (
        <span class="oculto-visualmente">
          {horarioDe(ctx, x)} <Marcas ctx={ctx} x={x} />
        </span>
      ) : (
        <span class="cal-bloque__marcas">
          <Marcas ctx={ctx} x={x} />
        </span>
      )}
    </>
  );
  if (quitable) {
    return (
      <button
        type="button"
        class={clase}
        {...atributosDeColor(x.color)}
        aria-label={ctx.t("calendario.fichas.quitar", {
          titulo: x.titulo,
          horario: horarioDe(ctx, x),
        })}
        onClick={() => alQuitar?.(x)}
      >
        {contenido}
      </button>
    );
  }
  return ruta ? (
    <a class={clase} {...atributosDeColor(x.color)} href={hrefDe(ruta)}>
      {contenido}
    </a>
  ) : (
    <span class={clase} {...atributosDeColor(x.color)}>
      {contenido}
    </span>
  );
}

// ---------------------------------------------------------------------------
// H8 · barra lateral de fichas (arrastrar a la vista, o tocar y luego tocar un hueco)
// ---------------------------------------------------------------------------

function BarraDeFichas({
  ctx,
  vista,
  activa,
  alSoltar,
}: {
  ctx: ContextoDeModulo;
  vista: Vista;
  activa: FichaActiva | null;
  alSoltar: (f: FichaActiva, d: Destino) => void;
}) {
  const t = ctx.t;
  const r = useFichas(ctx);
  const grupos = r?.grupos.filter((g) => g.fichas.length > 0) ?? [];
  const elegir = (f: FichaActiva | null) => fichaActiva.fijar(f);
  return (
    <aside
      id="cal-fichas"
      class="cal-fichas"
      aria-labelledby="cal-fichas-titulo"
    >
      <div class="fila">
        <h2 id="cal-fichas-titulo" class="cal-fichas__titulo">
          {t("calendario.fichas.titulo")}
        </h2>
        <a class="boton" href={hrefDe("/calendario/fichas")}>
          {t("calendario.fichas.gestionar")}
        </a>
      </div>
      {!r ? (
        <Cargando />
      ) : grupos.length === 0 ? (
        <p class="texto-tenue">{t("calendario.fichas.vacio")}</p>
      ) : (
        <div class="cal-fichas__grupos">
          {grupos.map((g) => (
            <section
              key={g.modulo}
              class="cal-fichas__grupo"
              aria-label={t(g.nombre)}
            >
              <h3 class="cal-fichas__grupo-titulo">{t(g.nombre)}</h3>
              <ul class="cal-fichas__lista">
                {g.fichas.map((f) => {
                  const clave = claveDeFicha(g.modulo, f.id);
                  return (
                    <li key={clave}>
                      <ChipDeFicha
                        ctx={ctx}
                        ficha={{ modulo: g.modulo, ficha: f, clave }}
                        pulsada={activa?.clave === clave}
                        elegir={elegir}
                        alSoltar={alSoltar}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {r && r.fallos.length > 0 && (
        <p class="aviso aviso--alerta">
          {t("calendario.fichas.fallo", {
            fuentes: r.fallos.map((f) => t(f.nombre)).join(", "),
          })}
        </p>
      )}
      <div
        class={
          activa
            ? "cal-fichas__estado"
            : "cal-fichas__estado cal-fichas__estado--inactivo"
        }
        role="status"
        aria-live="polite"
      >
        <span class="texto-tenue">
          {activa
            ? vista === "mes"
              ? t("calendario.fichas.instruccionMes", {
                  titulo: activa.ficha.titulo,
                })
              : t(
                  activa.ficha.repeticion.tipo === "semanal"
                    ? "calendario.fichas.instruccionSemanal"
                    : "calendario.fichas.instruccion",
                  {
                    titulo: activa.ficha.titulo,
                    n:
                      activa.ficha.repeticion.tipo === "semanal"
                        ? activa.ficha.repeticion.semanas
                        : 1,
                  },
                )
            : t("calendario.fichas.ayuda")}
        </span>
        {activa && (
          <button type="button" class="boton" onClick={() => elegir(null)}>
            {t("calendario.fichas.listo")}
          </button>
        )}
      </div>
    </aside>
  );
}

/** Umbral (px) para que mover el puntero cuente como arrastre y no como toque. */
const UMBRAL_ARRASTRE = 6;

/**
 * Una ficha: se toca para elegirla (teclado: Enter) o se arrastra con mouse o dedo hasta la
 * vista. Se usa Pointer Events (no la API de arrastrar de HTML, que no funciona con el dedo).
 */
function ChipDeFicha({
  ctx,
  ficha,
  pulsada,
  elegir,
  alSoltar,
}: {
  ctx: ContextoDeModulo;
  ficha: FichaActiva;
  pulsada: boolean;
  elegir: (f: FichaActiva | null) => void;
  alSoltar: (f: FichaActiva, d: Destino) => void;
}) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const arrastrando = useRef(false);
  const huboArrastre = useRef(false);
  const f = ficha.ficha;
  const terminar = () => {
    inicio.current = null;
    arrastrando.current = false;
    arrastre.fijar(null);
  };
  return (
    <button
      type="button"
      class="cal-ficha"
      {...atributosDeColor(f.color)}
      aria-pressed={pulsada}
      title={
        f.detalle
          ? `${f.detalle} · ${ctx.t("calendario.fichas.arrastrar")}`
          : ctx.t("calendario.fichas.arrastrar")
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        inicio.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const i = inicio.current;
        if (!i) return;
        if (
          !arrastrando.current &&
          Math.hypot(e.clientX - i.x, e.clientY - i.y) < UMBRAL_ARRASTRE
        )
          return;
        arrastrando.current = true;
        arrastre.fijar({
          ficha,
          x: e.clientX,
          y: e.clientY,
          destino: destinoEn(e.clientX, e.clientY),
        });
      }}
      onPointerUp={() => {
        const a = arrastre.valor();
        if (arrastrando.current) {
          huboArrastre.current = true;
          if (a?.destino) alSoltar(ficha, a.destino);
        }
        terminar();
      }}
      onPointerCancel={terminar}
      onClick={() => {
        if (huboArrastre.current) {
          huboArrastre.current = false;
          return;
        }
        elegir(pulsada ? null : ficha);
      }}
    >
      <span class="marca-color" aria-hidden="true" />
      <span class="cal-ficha__titulo">{f.titulo}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mes (como Google Calendar): celdas grandes, número arriba, barras de color
// ---------------------------------------------------------------------------

const MAX_PUNTOS = 4;

/** Títulos en el mes desde 480 px; en pantallas más angostas, puntos de color. */
function useEsMedio(): boolean {
  const consulta = "(min-width: 480px)";
  const [si, setSi] = useState(() => matchMedia(consulta).matches);
  useEffect(() => {
    const m = matchMedia(consulta);
    const cambiar = () => setSi(m.matches);
    m.addEventListener("change", cambiar);
    return () => m.removeEventListener("change", cambiar);
  }, []);
  return si;
}

function Mes({
  ctx,
  elementos,
  fecha,
  hoy,
  esAncho,
  ir,
  destino,
  ficha,
  alElegirConFicha,
}: {
  ctx: ContextoDeModulo;
  elementos: ElementoVisible[];
  fecha: string;
  hoy: string;
  esAncho: boolean;
  ir: (v: Vista, f: string, reemplazar?: boolean) => void;
  destino: Destino | null;
  ficha: FichaActiva | null;
  alElegirConFicha: (fecha: string) => void;
}) {
  const dias = cuadriculaDeMes(fecha);
  const grupos = new Map(
    agruparPorDia(elementos, dias[0]!, dias.length, zonaDelUsuario()).map(
      (g) => [g.fecha, [...g.todoElDia, ...g.conHora]],
    ),
  );
  const semanas = Array.from({ length: dias.length / 7 }, (_, i) =>
    dias.slice(i * 7, i * 7 + 7),
  );
  const rejilla = useRef<HTMLTableElement>(null);
  const [debeEnfocar, setDebeEnfocar] = useState(false);
  const conTitulos = useEsMedio();
  const maxTitulos = esAncho ? 3 : 2;

  useEffect(() => {
    if (!debeEnfocar) return;
    rejilla.current
      ?.querySelector<HTMLElement>(`[data-dia="${fecha}"]`)
      ?.focus();
    setDebeEnfocar(false);
  }, [fecha, debeEnfocar]);

  const abrir = (f: string) =>
    ficha ? alElegirConFicha(f) : ir("dia", f, false);

  const alTeclear = (e: KeyboardEvent) => {
    const pasos: Record<string, () => string> = {
      ArrowLeft: () => sumarDias(fecha, -1),
      ArrowRight: () => sumarDias(fecha, 1),
      ArrowUp: () => sumarDias(fecha, -7),
      ArrowDown: () => sumarDias(fecha, 7),
      Home: () => inicioDeSemana(fecha),
      End: () => sumarDias(inicioDeSemana(fecha), 6),
      PageUp: () => mover("mes", fecha, -1),
      PageDown: () => mover("mes", fecha, 1),
    };
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrir(fecha);
      return;
    }
    const paso = pasos[e.key];
    if (!paso) return;
    e.preventDefault();
    e.stopPropagation();
    setDebeEnfocar(true);
    ir("mes", paso());
  };

  return (
    <table
      class="cal-mes"
      role="grid"
      aria-label={fechas.mesAnio(fecha)}
      ref={rejilla}
      onKeyDown={alTeclear}
      style={{ "--cal-semanas": semanas.length }}
    >
      <thead>
        <tr>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <th key={d} scope="col" abbr={ctx.t(`calendario.dia.${d}`)}>
              {fechas.diaSemana(sumarDias(dias[0]!, d - 1))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {semanas.map((semana) => (
          <tr key={semana[0]}>
            {semana.map((f) => {
              const lista = grupos.get(f) ?? [];
              const clases = [
                "cal-mes__dia",
                mismoMes(f, fecha) ? "" : "cal-mes__dia--fuera",
                f === hoy ? "cal-hoy" : "",
                destino?.tipo === "dia" && destino.fecha === f
                  ? "cal-mes__dia--destino"
                  : "",
                ficha ? "cal-mes__dia--ficha" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <td
                  key={f}
                  role="gridcell"
                  class={clases}
                  aria-selected={f === fecha}
                  data-soltar="dia"
                  data-fecha={f}
                  onClick={(e) => {
                    // Clic en el espacio libre de la celda: como Google, abre ese día.
                    if (e.target === e.currentTarget) abrir(f);
                  }}
                >
                  <button
                    type="button"
                    class="cal-mes__numero"
                    data-dia={f}
                    tabIndex={f === fecha ? 0 : -1}
                    aria-label={`${fechas.diaLargo(f)}, ${ctx.t("calendario.elementos", { n: lista.length })}`}
                    aria-current={f === hoy ? "date" : undefined}
                    onClick={() => abrir(f)}
                  >
                    <span>
                      {f.endsWith("-01") && conTitulos
                        ? fechas.diaMes(f)
                        : Number(f.slice(8))}
                    </span>
                  </button>
                  {conTitulos ? (
                    <ul class="cal-mes__eventos" aria-hidden="true">
                      {lista.slice(0, maxTitulos).map((x) => (
                        <EventoDelMes key={x.id} ctx={ctx} x={x} dia={f} />
                      ))}
                      {lista.length > maxTitulos && (
                        <li>
                          <button
                            type="button"
                            class="cal-mes__mas"
                            tabIndex={-1}
                            onClick={() => ir("dia", f, false)}
                          >
                            {ctx.t("calendario.mas", {
                              n: lista.length - maxTitulos,
                            })}
                          </button>
                        </li>
                      )}
                    </ul>
                  ) : (
                    <span class="cal-mes__puntos" aria-hidden="true">
                      {lista.slice(0, MAX_PUNTOS).map((x) => (
                        <span
                          key={x.id}
                          {...atributosDeColor(x.color)}
                          class={
                            x.fuente === "externo"
                              ? "marca-color cal-punto--externo"
                              : "marca-color"
                          }
                        />
                      ))}
                      {lista.length > MAX_PUNTOS && (
                        <span class="cal-mes__mas-puntos">+</span>
                      )}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Como Google: todo el día = barra rellena; con hora = punto, hora y título; de otro módulo = contorno punteado. */
function EventoDelMes({
  ctx,
  x,
  dia,
}: {
  ctx: ContextoDeModulo;
  x: ElementoVisible;
  dia: string;
}) {
  const ruta = rutaDe(x);
  const hecho = x.hecho || (x.fuente === "propio" && x.cumplida);
  const barra = x.todoElDia || (!x.puntual && x.fechaFin !== x.fechaInicio);
  // Barras de varios días: se unen con la celda vecina dentro de la misma semana (como Google);
  // el título se escribe al empezar y al comienzo de cada semana.
  const vieneDeAntes = barra && x.fechaInicio < dia && diaSemana(dia) !== 1;
  const sigue = barra && x.fechaFin > dia && diaSemana(dia) !== 7;
  const clase = [
    "cal-mes__evento",
    barra ? "cal-mes__evento--barra" : "",
    vieneDeAntes ? "cal-mes__evento--viene" : "",
    sigue ? "cal-mes__evento--sigue" : "",
    x.fuente === "externo" ? "cal-mes__evento--externo" : "",
    hecho ? "cal-mes__evento--hecho" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const contenido = (
    <>
      {!barra && <span class="marca-color" />}
      {!barra && !x.todoElDia && (
        <span class="cal-mes__hora">{horaCorta(x.inicioMs)}</span>
      )}
      <span class="cal-mes__texto">{vieneDeAntes ? "\u00a0" : x.titulo}</span>
    </>
  );
  return (
    <li
      {...atributosDeColor(x.color)}
      title={`${x.titulo} · ${horarioDe(ctx, x)}`}
    >
      {ruta ? (
        <a class={clase} href={hrefDe(ruta)} tabIndex={-1}>
          {contenido}
        </a>
      ) : (
        <span class={clase}>{contenido}</span>
      )}
    </li>
  );
}

/** "7:00", "15:30": hora corta de 24 h para que quepa en la celda del mes. */
function horaCorta(ms: number): string {
  const m = zonaDelUsuario().aCivil(ms).minutos;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
