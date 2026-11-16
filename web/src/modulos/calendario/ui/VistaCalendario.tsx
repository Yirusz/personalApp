/**
 * Vistas agenda, día, semana y mes (H3, H7), con lo propio y lo de otros módulos (H4),
 * y el panel de fichas para poner y quitar cosas con un toque (H8, ADR-0015).
 * Ruta: /calendario/ver/:vista/:fecha. ← → cambian de periodo, T = hoy, N = nuevo
 * evento, Esc suelta la ficha; en el mes, las flechas recorren los días (cuadrícula ARIA).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import type { FichaDeCalendario } from '../../../nucleo/dominio/fichas';
import { esFechaCivil } from '../../../nucleo/dominio/zona-horaria';
import { atributosDeColor } from '../../../ui/color';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { zonaDelUsuario } from '../aplicacion/comun';
import { eliminarEvento } from '../aplicacion/eventos';
import { colocarFicha } from '../aplicacion/fichas';
import { agruparPorDia, columnasDelDia, cuadriculaDeMes, rangoDeDias } from '../dominio/distribucion';
import { claveDeFicha, horaDeHueco } from '../dominio/ficha';
import { componentes, diaSemana, fechaConDia, inicioDeSemana, mismoMes, semanaIso, sumarDias, sumarMeses } from '../dominio/fechas';
import type { ElementoVisible } from '../dominio/visible';
import { guardarPanelDeFichas, guardarVista, leerPanelDeFichas, leerVista, VISTAS, type Vista } from '../infraestructura/preferencias';
import { BotonSemana } from './BotonSemana';
import { AvisoDeFuentes, fechas, FilaDeElemento, hoyCivil, horarioDe, LineaDeAviso, Marcas, mensajeDeError, rutaDe, rutaDeVista, useEsAncho, useFichas, useVisibles, type Aviso } from './comun';

/** Ficha elegida en el panel: al tocar un hueco se pone; al tocar algo que ella creó, se quita. */
interface FichaActiva {
  modulo: string;
  ficha: FichaDeCalendario;
  clave: string;
}

const DIAS_AGENDA = 14;

function rangoDe(vista: Vista, fecha: string): { desde: string; dias: number } {
  if (vista === 'agenda') return { desde: fecha, dias: DIAS_AGENDA };
  if (vista === 'dia') return { desde: fecha, dias: 1 };
  if (vista === 'semana') return { desde: inicioDeSemana(fecha), dias: 7 };
  const dias = cuadriculaDeMes(fecha);
  return { desde: dias[0]!, dias: dias.length };
}

function mover(vista: Vista, fecha: string, paso: number): string {
  if (vista === 'agenda') return sumarDias(fecha, paso * 7);
  if (vista === 'dia') return sumarDias(fecha, paso);
  if (vista === 'semana') return sumarDias(fecha, paso * 7);
  const { anio, mes, dia } = componentes(fecha);
  const m = sumarMeses(anio, mes, paso);
  return fechaConDia(m.anio, m.mes, dia) ?? fechaConDia(m.anio, m.mes, 1)!;
}


function enCampo(destino: EventTarget | null): boolean {
  return destino instanceof HTMLElement && destino.closest('input, textarea, select, [contenteditable], [role="grid"]') !== null;
}

export function VistaCalendario({ ctx, params }: PropsDeVista) {
  const { t } = ctx;
  const hoy = hoyCivil(ctx);
  const vista: Vista = VISTAS.includes(params.vista as Vista) ? (params.vista as Vista) : leerVista();
  const fecha = params.fecha && esFechaCivil(params.fecha) ? params.fecha : hoy;
  const esAncho = useEsAncho();
  const { desde, dias } = rangoDe(vista, fecha);
  const rango = useMemo(() => rangoDeDias(desde, dias, zonaDelUsuario()), [desde, dias]);
  const estado = useVisibles(ctx, rango);

  const [panel, setPanel] = useState(leerPanelDeFichas);
  const [activa, setActiva] = useState<FichaActiva | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const conHoras = vista === 'dia' || vista === 'semana';
  const fichaEnUso = conHoras && panel ? activa : null;

  const ir = (v: Vista, f: string, reemplazar = true) => {
    guardarVista(v);
    ctx.navegar(rutaDeVista(v, f), { reemplazar });
  };

  const alternarPanel = () => {
    guardarPanelDeFichas(!panel);
    setPanel(!panel);
    setActiva(null);
  };

  /** Pone la ficha en ese día y minuto (media hora hacia abajo); se deshace en 10 s. */
  const colocar = async (f: FichaActiva, dia: string, minuto: number) => {
    setAviso(null);
    try {
      const inicio = zonaDelUsuario().aUtc(dia, horaDeHueco(minuto));
      const ev = await colocarFicha(ctx, f.modulo, f.ficha, inicio);
      const cuando = `${fechas.diaLargo(dia)}, ${ctx.formatos.hora(new Date(inicio))}`;
      await ofrecerDeshacer({
        mensaje: t(f.ficha.repeticion.tipo === 'semanal' ? 'calendario.fichas.puestaSemanal' : 'calendario.fichas.puesta', { titulo: f.ficha.titulo, cuando, n: f.ficha.repeticion.tipo === 'semanal' ? f.ficha.repeticion.semanas : 1 }),
        deshacer: () => eliminarEvento(ctx, ev.id),
      });
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    }
  };

  const quitar = (x: ElementoVisible) => {
    if (x.fuente !== 'propio') return;
    void ofrecerDeshacer({ mensaje: t(x.recurrente ? 'calendario.fichas.quitadaSerie' : 'calendario.fichas.quitada', { titulo: x.titulo }), ocultar: x.eventoId, confirmar: () => eliminarEvento(ctx, x.eventoId) });
  };

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enCampo(e.target)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        ir(vista, mover(vista, fecha, e.key === 'ArrowLeft' ? -1 : 1));
      } else if (e.key === 'Escape') setActiva(null);
      else if (e.key === 't' || e.key === 'T') ir(vista, hoy);
      else if (e.key === 'n' || e.key === 'N') ctx.navegar(vista === 'dia' ? `/calendario/nuevo/${fecha}` : '/calendario/nuevo');
    };
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, [vista, fecha, hoy]);

  const nuevo = vista === 'dia' ? `/calendario/nuevo/${fecha}` : '/calendario/nuevo';

  const titulo =
    vista === 'mes'
      ? fechas.mesAnio(fecha)
      : vista === 'dia'
        ? fechas.diaLargo(fecha)
        : vista === 'semana'
          ? t('calendario.semanaDe', { n: Number(semanaIso(fecha).slice(6)), desde: fechas.diaMes(desde), hasta: fechas.diaMes(sumarDias(desde, 6)) })
          : t('calendario.agendaDesde', { desde: fechas.diaMes(desde), hasta: fechas.diaMes(sumarDias(desde, dias - 1)) });

  return (
    <div class="pila cal">
      <div class="cal-cabecera">
        <div class="cal-periodo">
          <button type="button" class="boton" aria-keyshortcuts="T" onClick={() => ir(vista, hoy)} disabled={fecha === hoy}>
            {t('calendario.hoy')}
          </button>
          <button type="button" class="boton cal-icono" aria-label={t('calendario.anterior')} onClick={() => ir(vista, mover(vista, fecha, -1))}>
            ‹
          </button>
          <button type="button" class="boton cal-icono" aria-label={t('calendario.siguiente')} onClick={() => ir(vista, mover(vista, fecha, 1))}>
            ›
          </button>
          <h2 class="cal-titulo" aria-live="polite">
            {titulo}
          </h2>
        </div>
        <div class="cal-herramientas">
          <nav class="cal-segmentos" aria-label={t('calendario.vistas')}>
            {VISTAS.map((v) => (
              <a
                key={v}
                href={hrefDe(rutaDeVista(v, fecha))}
                class="cal-segmentos__opcion"
                aria-current={v === vista ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  ir(v, fecha);
                }}
              >
                {t(`calendario.vista.${v}`)}
              </a>
            ))}
          </nav>
          {conHoras && (
            <button type="button" class="boton" aria-pressed={panel} aria-controls="cal-fichas" onClick={alternarPanel}>
              <span aria-hidden="true">▦ </span>
              {t('calendario.fichas.boton')}
            </button>
          )}
          <a class="boton boton--primario cal-solo-ancho" href={hrefDe(nuevo)} aria-keyshortcuts="N">
            + {t('calendario.nuevoEvento')}
          </a>
          <a class="boton" href={hrefDe('/calendario/ics')} aria-label={t('calendario.importarExportarNombre')}>
            {t('calendario.importarExportar')}
          </a>
        </div>
        <p class="texto-tenue cal-atajos">{t(vista === 'mes' ? 'calendario.atajosMes' : 'calendario.atajos')}</p>
      </div>

      {conHoras && panel && <PanelDeFichas ctx={ctx} activa={activa} elegir={setActiva} />}
      <LineaDeAviso aviso={aviso} />

      <a class="cal-fab" href={hrefDe(nuevo)} aria-label={t('calendario.nuevoEvento')}>
        +
      </a>

      {estado.estado === 'cargando' ? (
        <Cargando />
      ) : estado.estado === 'error' ? (
        <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
      ) : (
        <>
          <AvisoDeFuentes ctx={ctx} visibles={estado.visibles} reintentar={estado.reintentar} />
          {vista === 'semana' && semanaIso(fecha) === semanaIso(hoy) && <BotonSemana ctx={ctx} />}
          {!estado.hayEventosPropios && estado.visibles.elementos.length === 0 && !(conHoras && panel) ? (
            <div class="pila">
              <Vacio>{t('calendario.sinEventos')}</Vacio>
              <div class="acciones">
                <a class="boton boton--primario" href={hrefDe('/calendario/nuevo')}>
                  {t('calendario.nuevoEvento')}
                </a>
                <a class="boton" href={hrefDe('/calendario/ics')}>
                  {t('calendario.importarExportarNombre')}
                </a>
              </div>
            </div>
          ) : vista === 'agenda' ? (
            <Agenda ctx={ctx} elementos={estado.visibles.elementos} desde={desde} dias={dias} hoy={hoy} />
          ) : vista === 'mes' ? (
            <Mes ctx={ctx} elementos={estado.visibles.elementos} fecha={fecha} hoy={hoy} esAncho={esAncho} ir={ir} />
          ) : (
            <Cuadricula
              ctx={ctx}
              elementos={estado.visibles.elementos}
              fechasVisibles={vista === 'dia' ? [fecha] : Array.from({ length: 7 }, (_, i) => sumarDias(desde, i))}
              hoy={hoy}
              esAncho={esAncho}
              alElegirDia={(f) => ir('dia', f, false)}
              ficha={fichaEnUso}
              alColocar={(dia, minuto) => fichaEnUso && void colocar(fichaEnUso, dia, minuto)}
              alQuitar={quitar}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CA3 · agenda
// ---------------------------------------------------------------------------

function Agenda({ ctx, elementos, desde, dias, hoy }: { ctx: ContextoDeModulo; elementos: ElementoVisible[]; desde: string; dias: number; hoy: string }) {
  const grupos = agruparPorDia(elementos, desde, dias, zonaDelUsuario()).filter((d) => d.todoElDia.length + d.conHora.length > 0);
  if (grupos.length === 0) return <Vacio>{ctx.t('calendario.vacioPeriodo')}</Vacio>;
  return (
    <div class="pila">
      {grupos.map((d) => (
        <section key={d.fecha} class="cal-dia-agenda" aria-labelledby={`cal-agenda-${d.fecha}`}>
          <h3 id={`cal-agenda-${d.fecha}`} class={d.fecha === hoy ? 'cal-dia-agenda__titulo cal-hoy' : 'cal-dia-agenda__titulo'}>
            {d.fecha === hoy ? `${ctx.t('calendario.hoy')} · ` : ''}
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
// CA4 · día y semana (cuadrícula horaria)
// ---------------------------------------------------------------------------

const HORAS = Array.from({ length: 24 }, (_, h) => h);
const HORA_INICIAL_VISIBLE = 7;
const MINUTOS_DIA = 1440;
/** Arrastre mínimo (min) para que cuente como rango y no como toque. */
const ARRASTRE_MINIMO = 30;

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const local = (fecha: string, minutos: number) => `${fecha}T${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;

function minutoEn(e: MouseEvent, columna: HTMLElement): number {
  const caja = columna.getBoundingClientRect();
  return Math.max(0, Math.min(MINUTOS_DIA - 1, ((e.clientY - caja.top) / caja.height) * MINUTOS_DIA));
}

/** Re-renderiza cada minuto (línea de "ahora" y "vencido"), solo mientras la vista está montada. */
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

function Cuadricula({
  ctx,
  elementos,
  fechasVisibles,
  hoy,
  esAncho,
  alElegirDia,
  ficha,
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
  alColocar: (fecha: string, minuto: number) => void;
  alQuitar: (x: ElementoVisible) => void;
}) {
  const zona = zonaDelUsuario();
  const desplazable = useRef<HTMLDivElement>(null);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const arrastro = useRef(false);
  const [sobre, setSobre] = useState<string | null>(null);
  const grupos = agruparPorDia(elementos, fechasVisibles[0]!, fechasVisibles.length, zona);
  const porFecha = new Map(grupos.map((g) => [g.fecha, g]));
  const civilAhora = zona.aCivil(useMinuto(ctx));
  const semana = fechasVisibles.length > 1;

  useLayoutEffect(() => {
    const d = desplazable.current;
    const fila = d?.querySelector<HTMLElement>(`[data-hora="${HORA_INICIAL_VISIBLE}"]`);
    // El contenedor es `position: relative`: offsetTop de la fila ya es relativo a él.
    if (d && fila) d.scrollTop = fila.offsetTop;
  }, [fechasVisibles[0]]);

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
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target !== e.currentTarget || ficha) return;
    const m = horaDeHueco(minutoEn(e, e.currentTarget as HTMLElement));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSeleccion({ fecha, desde: m, hasta: m + 30 });
  };
  const alMover = (e: PointerEvent) => {
    if (!seleccion) return;
    const fin = Math.min(MINUTOS_DIA, Math.ceil(minutoEn(e, e.currentTarget as HTMLElement) / 15) * 15);
    setSeleccion({ ...seleccion, hasta: Math.max(seleccion.desde + 15, fin) });
  };
  const alSoltar = () => {
    if (!seleccion) return;
    const { fecha, desde, hasta } = seleccion;
    setSeleccion(null);
    if (hasta - desde > ARRASTRE_MINIMO) {
      arrastro.current = true;
      ctx.navegar(`/calendario/nuevo/${local(fecha, desde)}/${hasta >= MINUTOS_DIA ? local(sumarDias(fecha, 1), 0) : local(fecha, hasta)}`);
    }
  };

  // Escritorio: arrastrar una ficha del panel hasta un hueco.
  const alSoltarFicha = (fecha: string, e: DragEvent) => {
    e.preventDefault();
    setSobre(null);
    if (ficha) alColocar(fecha, minutoEn(e, e.currentTarget as HTMLElement));
  };

  return (
    <div class="pila">
      <div class={semana ? 'cal-rejilla cal-rejilla--semana' : 'cal-rejilla'} style={{ '--cal-columnas': fechasVisibles.length }}>
        <div class="cal-rejilla__encabezado">
          <span />
          {fechasVisibles.map((f) =>
            semana ? (
              <button key={f} type="button" class={f === hoy ? 'cal-col-titulo cal-hoy' : 'cal-col-titulo'} aria-label={fechas.diaLargo(f)} aria-current={f === hoy ? 'date' : undefined} onClick={() => alElegirDia(f)}>
                <span class="cal-col-titulo__dia" aria-hidden="true">
                  {esAncho ? fechas.diaCorto(f) : ctx.t(`calendario.diaCorto.${diaSemana(f)}`)}
                </span>
                {!esAncho && (
                  <span class="cal-col-titulo__numero" aria-hidden="true">
                    {Number(f.slice(8))}
                  </span>
                )}
              </button>
            ) : (
              <span key={f} class={f === hoy ? 'cal-col-titulo cal-hoy' : 'cal-col-titulo'} aria-hidden="true">
                {fechas.diaCorto(f)}
              </span>
            ),
          )}
        </div>
        <div class="cal-rejilla__todo-el-dia">
          <span class="texto-tenue cal-rejilla__etiqueta">{ctx.t('calendario.todoElDia')}</span>
          {fechasVisibles.map((f) => (
            <ul key={f} class="cal-lista-compacta" aria-label={`${ctx.t('calendario.todoElDia')}, ${fechas.diaLargo(f)}`}>
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
                {h === 0 ? '' : fechas.horaSola(h)}
              </span>
            ))}
          </div>
          {fechasVisibles.map((f) => (
            <div
              key={f}
              class={`cal-columna${ficha ? ' cal-columna--ficha' : ''}${sobre === f ? ' cal-columna--sobre' : ''}`}
              onClick={(e) => alTocar(f, e)}
              onPointerDown={(e) => alPresionar(f, e)}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={() => setSeleccion(null)}
              onDragOver={(e) => {
                if (!ficha) return;
                e.preventDefault();
                setSobre(f);
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => alSoltarFicha(f, e)}
              aria-label={fechas.diaLargo(f)}
              role="list"
            >
              {columnasDelDia(porFecha.get(f)?.conHora ?? [], f, zona).map((p) => (
                <div
                  key={p.elemento.id}
                  role="listitem"
                  class="cal-posicion"
                  style={{ '--desde': p.desdeMinuto, '--hasta': Math.max(p.hastaMinuto, p.desdeMinuto + 30), '--col': p.columna, '--cols': p.columnas }}
                >
                  <Bloque ctx={ctx} x={p.elemento} ficha={ficha} alQuitar={alQuitar} />
                </div>
              ))}
              {seleccion?.fecha === f && <div class="cal-seleccion" style={{ '--desde': seleccion.desde, '--hasta': seleccion.hasta }} aria-hidden="true" />}
              {f === civilAhora.fecha && <div class="cal-ahora" style={{ '--desde': civilAhora.minutos }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
      {elementos.length === 0 && <p class="texto-tenue">{ctx.t(semana ? 'calendario.vacioPeriodo' : 'calendario.vacioDia')}</p>}
    </div>
  );
}

function Bloque({ ctx, x, ficha, alQuitar }: { ctx: ContextoDeModulo; x: ElementoVisible; ficha?: FichaActiva | null; alQuitar?: (x: ElementoVisible) => void }) {
  const ruta = rutaDe(x);
  // Con una ficha activa, lo que esa ficha creó se quita con un toque.
  const quitable = !!ficha && x.fuente === 'propio' && x.ficha === ficha.clave;
  const clase = `cal-bloque${x.fuente === 'externo' ? ' cal-bloque--externo' : ''}${x.hecho || (x.fuente === 'propio' && x.cumplida) ? ' cal-bloque--hecho' : ''}${quitable ? ' cal-bloque--quitable' : ''}`;
  const contenido = (
    <>
      <span class="cal-bloque__titulo">
        {quitable && <span aria-hidden="true">✕ </span>}
        {x.titulo}
      </span>
      {!x.todoElDia && <span class="cal-bloque__hora">{horarioDe(ctx, x)}</span>}
      <span class="cal-bloque__marcas">
        <Marcas ctx={ctx} x={x} />
      </span>
    </>
  );
  if (quitable) {
    return (
      <button type="button" class={clase} {...atributosDeColor(x.color)} aria-label={ctx.t('calendario.fichas.quitar', { titulo: x.titulo, horario: horarioDe(ctx, x) })} onClick={() => alQuitar?.(x)}>
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
// H8 · panel de fichas
// ---------------------------------------------------------------------------

function PanelDeFichas({ ctx, activa, elegir }: { ctx: ContextoDeModulo; activa: FichaActiva | null; elegir: (f: FichaActiva | null) => void }) {
  const t = ctx.t;
  const r = useFichas(ctx);
  const grupos = r?.grupos.filter((g) => g.fichas.length > 0) ?? [];
  return (
    <section id="cal-fichas" class="cal-fichas" aria-labelledby="cal-fichas-titulo">
      <div class="fila">
        <h2 id="cal-fichas-titulo" class="cal-fichas__titulo">
          {t('calendario.fichas.titulo')}
        </h2>
        <a class="boton" href={hrefDe('/calendario/fichas')}>
          {t('calendario.fichas.gestionar')}
        </a>
      </div>
      {!r ? (
        <Cargando />
      ) : grupos.length === 0 ? (
        <p class="texto-tenue">{t('calendario.fichas.vacio')}</p>
      ) : (
        <div class="cal-fichas__lista" role="group" aria-label={t('calendario.fichas.titulo')}>
          {grupos.flatMap((g) =>
            g.fichas.map((f) => {
              const clave = claveDeFicha(g.modulo, f.id);
              const pulsada = activa?.clave === clave;
              const nueva = { modulo: g.modulo, ficha: f, clave };
              return (
                <button
                  key={clave}
                  type="button"
                  class="cal-ficha"
                  {...atributosDeColor(f.color)}
                  aria-pressed={pulsada}
                  title={f.detalle}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer?.setData('text/plain', f.titulo);
                    elegir(nueva);
                  }}
                  onClick={() => elegir(pulsada ? null : nueva)}
                >
                  <span class="marca-color" aria-hidden="true" />
                  {f.titulo}
                </button>
              );
            }),
          )}
        </div>
      )}
      {r && r.fallos.length > 0 && <p class="aviso aviso--alerta">{t('calendario.fichas.fallo', { fuentes: r.fallos.map((f) => t(f.nombre)).join(', ') })}</p>}
      <div class="fila cal-fichas__estado" role="status" aria-live="polite">
        <span class="texto-tenue">
          {activa
            ? t(activa.ficha.repeticion.tipo === 'semanal' ? 'calendario.fichas.instruccionSemanal' : 'calendario.fichas.instruccion', {
                titulo: activa.ficha.titulo,
                n: activa.ficha.repeticion.tipo === 'semanal' ? activa.ficha.repeticion.semanas : 1,
              })
            : t('calendario.fichas.ayuda')}
        </span>
        {activa && (
          <button type="button" class="boton" onClick={() => elegir(null)}>
            {t('calendario.fichas.listo')}
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CA9 · mes (cuadrícula ARIA con foco itinerante)
// ---------------------------------------------------------------------------

const MAX_TITULOS = 3;
const MAX_PUNTOS = 4;

function Mes({
  ctx,
  elementos,
  fecha,
  hoy,
  esAncho,
  ir,
}: {
  ctx: ContextoDeModulo;
  elementos: ElementoVisible[];
  fecha: string;
  hoy: string;
  esAncho: boolean;
  ir: (v: Vista, f: string, reemplazar?: boolean) => void;
}) {
  const dias = cuadriculaDeMes(fecha);
  const grupos = new Map(agruparPorDia(elementos, dias[0]!, dias.length, zonaDelUsuario()).map((g) => [g.fecha, [...g.todoElDia, ...g.conHora]]));
  const semanas = Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));
  const rejilla = useRef<HTMLTableElement>(null);
  const [debeEnfocar, setDebeEnfocar] = useState(false);

  useEffect(() => {
    if (!debeEnfocar) return;
    rejilla.current?.querySelector<HTMLElement>(`[data-fecha="${fecha}"]`)?.focus();
    setDebeEnfocar(false);
  }, [fecha, debeEnfocar]);

  const alTeclear = (e: KeyboardEvent) => {
    const pasos: Record<string, () => string> = {
      ArrowLeft: () => sumarDias(fecha, -1),
      ArrowRight: () => sumarDias(fecha, 1),
      ArrowUp: () => sumarDias(fecha, -7),
      ArrowDown: () => sumarDias(fecha, 7),
      Home: () => inicioDeSemana(fecha),
      End: () => sumarDias(inicioDeSemana(fecha), 6),
      PageUp: () => mover('mes', fecha, -1),
      PageDown: () => mover('mes', fecha, 1),
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ir('dia', fecha, false);
      return;
    }
    const paso = pasos[e.key];
    if (!paso) return;
    e.preventDefault();
    e.stopPropagation();
    setDebeEnfocar(true);
    ir('mes', paso());
  };

  return (
    <table class="cal-mes" role="grid" aria-label={fechas.mesAnio(fecha)} ref={rejilla} onKeyDown={alTeclear}>
      <thead>
        <tr>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <th key={d} scope="col" abbr={ctx.t(`calendario.dia.${d}`)}>
              {ctx.t(`calendario.diaCorto.${d}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {semanas.map((semana) => (
          <tr key={semana[0]}>
            {semana.map((f) => {
              const lista = grupos.get(f) ?? [];
              const clases = ['cal-mes__dia', mismoMes(f, fecha) ? '' : 'cal-mes__dia--fuera', f === hoy ? 'cal-hoy' : ''].filter(Boolean).join(' ');
              return (
                <td key={f} role="gridcell" class={clases} aria-selected={f === fecha}>
                  <button
                    type="button"
                    class="cal-mes__numero"
                    data-fecha={f}
                    tabIndex={f === fecha ? 0 : -1}
                    aria-label={`${fechas.diaLargo(f)}, ${ctx.t('calendario.elementos', { n: lista.length })}`}
                    aria-current={f === hoy ? 'date' : undefined}
                    onClick={() => ir('dia', f, false)}
                  >
                    {Number(f.slice(8))}
                  </button>
                  {esAncho ? (
                    <ul class="cal-mes__titulos" aria-hidden="true">
                      {lista.slice(0, MAX_TITULOS).map((x) => (
                        <li key={x.id} {...atributosDeColor(x.color)} class={x.fuente === 'externo' ? 'cal-mes__titulo cal-mes__titulo--externo' : 'cal-mes__titulo'}>
                          <span class="marca-color" />
                          <span class={x.hecho ? 'tachado' : undefined}>{x.titulo}</span>
                        </li>
                      ))}
                      {lista.length > MAX_TITULOS && <li class="texto-tenue">{ctx.t('calendario.mas', { n: lista.length - MAX_TITULOS })}</li>}
                    </ul>
                  ) : (
                    <span class="cal-mes__puntos" aria-hidden="true">
                      {lista.slice(0, MAX_PUNTOS).map((x) => (
                        <span key={x.id} {...atributosDeColor(x.color)} class={x.fuente === 'externo' ? 'marca-color cal-punto--externo' : 'marca-color'} />
                      ))}
                      {lista.length > MAX_PUNTOS && <span class="cal-mes__mas">+</span>}
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
