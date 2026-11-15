/**
 * CA3, CA4, CA9: vistas agenda, día, semana y mes, con lo propio y lo de otros
 * módulos. Ruta: /calendario/ver/:vista/:fecha. ← → cambian de periodo, T = hoy,
 * N = nuevo evento; en el mes, las flechas recorren los días (cuadrícula ARIA).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { esFechaCivil } from '../../../nucleo/dominio/zona-horaria';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { zonaDelUsuario } from '../aplicacion/comun';
import { agruparPorDia, columnasDelDia, cuadriculaDeMes, rangoDeDias } from '../dominio/distribucion';
import { componentes, diaSemana, fechaConDia, inicioDeSemana, mismoMes, semanaIso, sumarDias, sumarMeses } from '../dominio/fechas';
import type { ElementoVisible } from '../dominio/visible';
import { guardarVista, leerVista, VISTAS, type Vista } from '../infraestructura/preferencias';
import { BotonSemana } from './BotonSemana';
import { AvisoDeFuentes, fechas, FilaDeElemento, hoyCivil, horarioDe, Marcas, rutaDe, rutaDeVista, useEsAncho, useVisibles } from './comun';

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

  const ir = (v: Vista, f: string, reemplazar = true) => {
    guardarVista(v);
    ctx.navegar(rutaDeVista(v, f), { reemplazar });
  };

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enCampo(e.target)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        ir(vista, mover(vista, fecha, e.key === 'ArrowLeft' ? -1 : 1));
      } else if (e.key === 't' || e.key === 'T') ir(vista, hoy);
      else if (e.key === 'n' || e.key === 'N') ctx.navegar(vista === 'dia' ? `/calendario/nuevo/${fecha}` : '/calendario/nuevo');
    };
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, [vista, fecha, hoy]);

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
          <button type="button" class="boton" aria-label={t('calendario.anterior')} onClick={() => ir(vista, mover(vista, fecha, -1))}>
            ‹
          </button>
          <button type="button" class="boton" aria-keyshortcuts="T" onClick={() => ir(vista, hoy)} disabled={fecha === hoy}>
            {t('calendario.hoy')}
          </button>
          <button type="button" class="boton" aria-label={t('calendario.siguiente')} onClick={() => ir(vista, mover(vista, fecha, 1))}>
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
          <a class="boton boton--primario" href={hrefDe(vista === 'dia' ? `/calendario/nuevo/${fecha}` : '/calendario/nuevo')} aria-keyshortcuts="N">
            + {t('calendario.nuevoEvento')}
          </a>
          <a class="boton" href={hrefDe('/calendario/ics')} aria-label={t('calendario.importarExportarNombre')}>
            {t('calendario.importarExportar')}
          </a>
        </div>
        <p class="texto-tenue cal-atajos">{t(vista === 'mes' ? 'calendario.atajosMes' : 'calendario.atajos')}</p>
      </div>

      {estado.estado === 'cargando' ? (
        <Cargando />
      ) : estado.estado === 'error' ? (
        <ErrorConReintento error={estado.error} reintentar={estado.reintentar} />
      ) : (
        <>
          <AvisoDeFuentes ctx={ctx} visibles={estado.visibles} reintentar={estado.reintentar} />
          {vista === 'semana' && semanaIso(fecha) === semanaIso(hoy) && <BotonSemana ctx={ctx} />}
          {!estado.hayEventosPropios && estado.visibles.elementos.length === 0 ? (
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
              seleccionada={fecha}
              hoy={hoy}
              esAncho={esAncho}
              alElegirDia={(f) => ir('semana', f)}
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

function Cuadricula({
  ctx,
  elementos,
  fechasVisibles,
  seleccionada,
  hoy,
  esAncho,
  alElegirDia,
}: {
  ctx: ContextoDeModulo;
  elementos: ElementoVisible[];
  fechasVisibles: string[];
  seleccionada: string;
  hoy: string;
  esAncho: boolean;
  alElegirDia: (fecha: string) => void;
}) {
  const zona = zonaDelUsuario();
  const desplazable = useRef<HTMLDivElement>(null);
  // En pantallas angostas la semana se ve un día a la vez, con una tira para elegirlo.
  const columnas = esAncho || fechasVisibles.length === 1 ? fechasVisibles : [fechasVisibles.includes(seleccionada) ? seleccionada : fechasVisibles[0]!];
  const grupos = agruparPorDia(elementos, fechasVisibles[0]!, fechasVisibles.length, zona);
  const porFecha = new Map(grupos.map((g) => [g.fecha, g]));
  const ahora = ctx.reloj.ahora().getTime();
  const civilAhora = zona.aCivil(ahora);

  useLayoutEffect(() => {
    const d = desplazable.current;
    const fila = d?.querySelector<HTMLElement>(`[data-hora="${HORA_INICIAL_VISIBLE}"]`);
    if (d && fila) d.scrollTop = fila.offsetTop - d.offsetTop;
  }, [fechasVisibles[0]]);

  const crearEn = (fecha: string, e: MouseEvent) => {
    if (e.target !== e.currentTarget) return; // clic en un evento: lo maneja el enlace
    const caja = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const hora = Math.max(0, Math.min(23, Math.floor(((e.clientY - caja.top) / caja.height) * 24)));
    ctx.navegar(`/calendario/nuevo/${fecha}T${String(hora).padStart(2, '0')}:00`);
  };

  return (
    <div class="pila">
      {!esAncho && fechasVisibles.length === 7 && (
        <div class="cal-tira" role="group" aria-label={ctx.t('calendario.diaDeLaSemana')}>
          {fechasVisibles.map((f) => {
            const n = (porFecha.get(f)?.todoElDia.length ?? 0) + (porFecha.get(f)?.conHora.length ?? 0);
            return (
              <button
                key={f}
                type="button"
                class={f === hoy ? 'cal-tira__dia cal-hoy' : 'cal-tira__dia'}
                aria-pressed={f === columnas[0]}
                aria-label={`${fechas.diaLargo(f)}, ${ctx.t('calendario.elementos', { n })}`}
                onClick={() => alElegirDia(f)}
              >
                <span aria-hidden="true">{ctx.t(`calendario.diaCorto.${diaSemana(f)}`)}</span>
                <strong aria-hidden="true">{Number(f.slice(8))}</strong>
                {n > 0 && <span class="cal-tira__punto" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}

      <div class="cal-rejilla" style={{ '--cal-columnas': columnas.length }}>
        <div class="cal-rejilla__encabezado" aria-hidden={columnas.length === 1 ? 'true' : undefined}>
          <span />
          {columnas.map((f) => (
            <span key={f} class={f === hoy ? 'cal-col-titulo cal-hoy' : 'cal-col-titulo'}>
              {fechas.diaCorto(f)}
            </span>
          ))}
        </div>
        <div class="cal-rejilla__todo-el-dia">
          <span class="texto-tenue cal-rejilla__etiqueta">{ctx.t('calendario.todoElDia')}</span>
          {columnas.map((f) => (
            <ul key={f} class="cal-lista-compacta" aria-label={`${ctx.t('calendario.todoElDia')}, ${fechas.diaLargo(f)}`}>
              {(porFecha.get(f)?.todoElDia ?? []).map((x) => (
                <li key={x.id}>
                  <Bloque ctx={ctx} x={x} />
                </li>
              ))}
            </ul>
          ))}
        </div>
        <div class="cal-rejilla__horas" ref={desplazable}>
          <div class="cal-rejilla__etiquetas" aria-hidden="true">
            {HORAS.map((h) => (
              <span key={h} class="cal-hora" data-hora={h}>
                {h === 0 ? '' : ctx.formatos.hora(new Date(zona.aUtc(fechasVisibles[0]!, h * 60)))}
              </span>
            ))}
          </div>
          {columnas.map((f) => (
            <div key={f} class="cal-columna" onClick={(e) => crearEn(f, e)} aria-label={fechas.diaLargo(f)} role="list">
              {columnasDelDia(porFecha.get(f)?.conHora ?? [], f, zona).map((p) => (
                <div
                  key={p.elemento.id}
                  role="listitem"
                  class="cal-posicion"
                  style={{ '--desde': p.desdeMinuto, '--hasta': Math.max(p.hastaMinuto, p.desdeMinuto + 30), '--col': p.columna, '--cols': p.columnas }}
                >
                  <Bloque ctx={ctx} x={p.elemento} />
                </div>
              ))}
              {f === civilAhora.fecha && <div class="cal-ahora" style={{ '--desde': civilAhora.minutos }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
      {elementos.length === 0 && <p class="texto-tenue">{ctx.t(columnas.length === 1 ? 'calendario.vacioDia' : 'calendario.vacioPeriodo')}</p>}
    </div>
  );
}

function Bloque({ ctx, x }: { ctx: ContextoDeModulo; x: ElementoVisible }) {
  const ruta = rutaDe(x);
  const clase = `cal-bloque${x.fuente === 'externo' ? ' cal-bloque--externo' : ''}${x.hecho || (x.fuente === 'propio' && x.cumplida) ? ' cal-bloque--hecho' : ''}`;
  const contenido = (
    <>
      <span class="cal-bloque__titulo">{x.titulo}</span>
      {!x.todoElDia && <span class="cal-bloque__hora">{horarioDe(ctx, x)}</span>}
      <span class="cal-bloque__marcas">
        <Marcas ctx={ctx} x={x} />
      </span>
    </>
  );
  return ruta ? (
    <a class={clase} data-color={x.color} href={hrefDe(ruta)}>
      {contenido}
    </a>
  ) : (
    <span class={clase} data-color={x.color}>
      {contenido}
    </span>
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
                        <li key={x.id} data-color={x.color} class={x.fuente === 'externo' ? 'cal-mes__titulo cal-mes__titulo--externo' : 'cal-mes__titulo'}>
                          <span class="marca-color" />
                          <span class={x.hecho ? 'tachado' : undefined}>{x.titulo}</span>
                        </li>
                      ))}
                      {lista.length > MAX_TITULOS && <li class="texto-tenue">{ctx.t('calendario.mas', { n: lista.length - MAX_TITULOS })}</li>}
                    </ul>
                  ) : (
                    <span class="cal-mes__puntos" aria-hidden="true">
                      {lista.slice(0, MAX_PUNTOS).map((x) => (
                        <span key={x.id} data-color={x.color} class={x.fuente === 'externo' ? 'marca-color cal-punto--externo' : 'marca-color'} />
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
