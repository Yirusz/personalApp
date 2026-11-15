/**
 * Formulario de evento (CA1, CA5, CA8, CA12) y de una sola ocurrencia (CA7).
 * Los datos se revisan aquí para señalar todo lo que falta; el dominio vuelve a validar.
 */
import { useRef, useState } from 'preact/hooks';
import { COLORES_CATEGORICOS, type ColorCategorico } from '../../../nucleo/dominio/agenda';
import type { ContextoDeModulo } from '../../../nucleo/contrato';
import { esFechaCivil } from '../../../nucleo/dominio/zona-horaria';
import { hrefDe } from '../../../ui/enrutador';
import type { DatosDeEvento, DatosDeOcurrencia, EventoDeCalendario } from '../dominio/evento';
import { LUGAR_MAX, NOTAS_MAX, RECORDATORIO_MAX_MIN, RECORDATORIOS_MAX, TITULO_MAX } from '../dominio/evento';
import { diaSemana, DIAS_SEMANA, type DiaSemana } from '../dominio/fechas';
import { CONTEO_MAX, FRECUENCIAS, INTERVALO_MAX, type Frecuencia } from '../dominio/recurrencia';
import { aria, Ayuda, Campo, enfocarPrimerError, ErrorDeCampo, GarantiasDeAviso, idDeControl, LineaDeAviso, repartirError, type Aviso, type ErroresDeCampo } from './comun';

export interface Borrador {
  titulo: string;
  lugar: string;
  notas: string;
  color: ColorCategorico;
  todoElDia: boolean;
  inicioLocal: string;
  finLocal: string;
  primerDia: string;
  ultimoDia: string;
  repetir: 'no' | Frecuencia;
  intervalo: string;
  dias: DiaSemana[];
  termina: 'nunca' | 'fecha' | 'conteo';
  hasta: string;
  veces: string;
  recordatorios: number[];
  compromiso: boolean;
}

const PRESETS = [0, 10, 30, 60, 1440, 10080];
const MS_MIN = 60_000;

export function borradorDesde(ctx: ContextoDeModulo, d: DatosDeEvento | (DatosDeOcurrencia & Partial<DatosDeEvento>), todoElDia: boolean): Borrador {
  const f = ctx.formatos;
  const r = d.recurrencia ?? null;
  return {
    titulo: d.titulo,
    lugar: d.lugar,
    notas: d.notas,
    color: d.color ?? 'azul',
    todoElDia,
    inicioLocal: todoElDia ? `${d.inicio}T09:00` : f.entradaLocal(d.inicio),
    finLocal: todoElDia ? `${d.fin}T10:00` : f.entradaLocal(d.fin),
    primerDia: todoElDia ? d.inicio : f.entradaLocal(d.inicio).slice(0, 10),
    ultimoDia: todoElDia ? d.fin : f.entradaLocal(d.fin).slice(0, 10),
    repetir: r?.frecuencia ?? 'no',
    intervalo: String(r?.intervalo ?? 1),
    dias: r?.dias ?? [],
    termina: r?.fin.tipo ?? 'nunca',
    hasta: r?.fin.tipo === 'fecha' ? r.fin.hasta : '',
    veces: r?.fin.tipo === 'conteo' ? String(r.fin.veces) : '10',
    recordatorios: [...(d.recordatorios ?? [])],
    compromiso: d.compromiso ?? false,
  };
}

/** Nuevo evento: en la fecha/hora pedida o en la próxima hora en punto; dura 1 h. */
export function borradorNuevo(ctx: ContextoDeModulo, inicio?: string): Borrador {
  const f = ctx.formatos;
  let inicioIso: string | null = null;
  if (inicio && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inicio)) inicioIso = f.desdeEntradaLocal(inicio);
  else if (inicio && esFechaCivil(inicio)) inicioIso = f.desdeEntradaLocal(`${inicio}T09:00`);
  if (!inicioIso) {
    const ahora = ctx.reloj.ahora().getTime();
    inicioIso = new Date(Math.ceil(ahora / 3_600_000) * 3_600_000).toISOString();
  }
  const fin = new Date(Date.parse(inicioIso) + 60 * MS_MIN).toISOString();
  return borradorDesde(ctx, { titulo: '', lugar: '', notas: '', color: 'azul', todoElDia: false, inicio: inicioIso, fin, recordatorios: [10], recurrencia: null, compromiso: false }, false);
}

export function textoDeRecordatorio(ctx: ContextoDeModulo, m: number): string {
  if (PRESETS.includes(m)) return ctx.t(`calendario.recordatorio.${m}`);
  if (m % 1440 === 0) return ctx.t('calendario.recordatorio.dias', { n: m / 1440 });
  if (m % 60 === 0) return ctx.t('calendario.recordatorio.horas', { n: m / 60 });
  return ctx.t('calendario.recordatorio.minutos', { n: m });
}

/** Convierte el borrador; devuelve los errores de todos los campos que se pueden revisar sin el dominio. */
export function aDatos(ctx: ContextoDeModulo, b: Borrador): { datos: DatosDeEvento | null; errores: ErroresDeCampo } {
  const t = ctx.t;
  const errores: ErroresDeCampo = {};
  if (!b.titulo.trim()) errores.titulo = t('calendario.error.titulo.vacio');
  let inicio: string;
  let fin: string;
  if (b.todoElDia) {
    if (!esFechaCivil(b.primerDia)) errores.inicio = t('calendario.error.fecha');
    if (!esFechaCivil(b.ultimoDia)) errores.fin = t('calendario.error.fecha');
    inicio = b.primerDia;
    fin = b.ultimoDia;
  } else {
    inicio = ctx.formatos.desdeEntradaLocal(b.inicioLocal) ?? '';
    fin = ctx.formatos.desdeEntradaLocal(b.finLocal) ?? '';
    if (!inicio) errores.inicio = t('calendario.error.fecha');
    if (!fin) errores.fin = t('calendario.error.fecha');
  }
  let recurrencia: DatosDeEvento['recurrencia'] = null;
  if (b.repetir !== 'no') {
    const intervalo = Number(b.intervalo);
    const veces = Number(b.veces);
    const finRep =
      b.termina === 'fecha' ? { tipo: 'fecha' as const, hasta: b.hasta } : b.termina === 'conteo' ? { tipo: 'conteo' as const, veces } : { tipo: 'nunca' as const };
    if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > INTERVALO_MAX || (b.termina === 'fecha' && !esFechaCivil(b.hasta)) || (b.termina === 'conteo' && (!Number.isInteger(veces) || veces < 1 || veces > CONTEO_MAX)) || (b.repetir === 'semanal' && b.dias.length === 0)) {
      errores.recurrencia = t('calendario.error.recurrencia');
    }
    recurrencia = { frecuencia: b.repetir, intervalo, dias: b.dias, fin: finRep };
  }
  if (Object.keys(errores).length > 0) return { datos: null, errores };
  return {
    datos: {
      titulo: b.titulo,
      lugar: b.lugar,
      notas: b.notas,
      color: b.color,
      todoElDia: b.todoElDia,
      inicio,
      fin,
      recordatorios: b.recordatorios,
      recurrencia,
      compromiso: b.compromiso && !b.todoElDia,
    },
    errores,
  };
}

export function FormularioEvento({
  ctx,
  inicial,
  modo,
  textoGuardar,
  alGuardar,
  volverA,
  extra,
}: {
  ctx: ContextoDeModulo;
  inicial: Borrador;
  /** `ocurrencia`: solo título, horario, lugar y notas (editar solo esta). */
  modo: 'evento' | 'ocurrencia';
  textoGuardar: string;
  alGuardar: (datos: DatosDeEvento) => Promise<string>;
  volverA: string;
  extra?: preact.ComponentChildren;
}) {
  const { t } = ctx;
  const [b, setB] = useState(inicial);
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [otroN, setOtroN] = useState('2');
  const [otroUnidad, setOtroUnidad] = useState<'1' | '60' | '1440'>('60');
  const formulario = useRef<HTMLFormElement>(null);
  const esEvento = modo === 'evento';

  const cambiar = (c: Partial<Borrador>) => {
    setB((x) => ({ ...x, ...c }));
    setErrores((e) => {
      const copia = { ...e };
      for (const k of Object.keys(c)) {
        const campo = ({ inicioLocal: 'inicio', primerDia: 'inicio', finLocal: 'fin', ultimoDia: 'fin', intervalo: 'recurrencia', dias: 'recurrencia', termina: 'recurrencia', hasta: 'recurrencia', veces: 'recurrencia', repetir: 'recurrencia' } as Record<string, keyof ErroresDeCampo>)[k] ?? (k as keyof ErroresDeCampo);
        delete copia[campo];
      }
      return copia;
    });
  };

  /** Al mover el inicio se conserva la duración. */
  const cambiarInicio = (valor: string) => {
    const antes = ctx.formatos.desdeEntradaLocal(b.inicioLocal);
    const finAntes = ctx.formatos.desdeEntradaLocal(b.finLocal);
    const nuevo = ctx.formatos.desdeEntradaLocal(valor);
    const duracion = antes && finAntes && Date.parse(finAntes) > Date.parse(antes) ? Date.parse(finAntes) - Date.parse(antes) : 60 * MS_MIN;
    const c: Partial<Borrador> = { inicioLocal: valor };
    if (nuevo) c.finLocal = ctx.formatos.entradaLocal(new Date(Date.parse(nuevo) + duracion));
    if (nuevo && b.repetir === 'semanal' && b.dias.length <= 1) c.dias = [diaSemana(valor.slice(0, 10))];
    cambiar(c);
  };

  const fechaInicio = b.todoElDia ? b.primerDia : b.inicioLocal.slice(0, 10);
  const alternarRecordatorio = (m: number, activo: boolean) =>
    cambiar({ recordatorios: activo ? [...new Set([...b.recordatorios, m])].sort((x, y) => x - y) : b.recordatorios.filter((x) => x !== m) });
  const personalizados = b.recordatorios.filter((m) => !PRESETS.includes(m));

  const enviar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    const { datos, errores: revision } = aDatos(ctx, b);
    if (!datos) {
      setErrores(revision);
      enfocarPrimerError(formulario.current);
      return;
    }
    setGuardando(true);
    try {
      setAviso({ ok: true, texto: await alGuardar(datos) });
      setErrores({});
    } catch (error) {
      const { campos, general } = repartirError(t, error);
      setErrores(campos);
      if (general) setAviso({ ok: false, texto: general });
      enfocarPrimerError(formulario.current);
    } finally {
      setGuardando(false);
    }
  };

  const valor = (e: Event) => (e.currentTarget as HTMLInputElement).value;

  return (
    <form ref={formulario} class="tarjeta pila" onSubmit={enviar} noValidate>
      <Campo campo="titulo" etiqueta={t('calendario.campo.titulo')} error={errores.titulo}>
        <input value={b.titulo} maxLength={TITULO_MAX} autoComplete="off" onInput={(e) => cambiar({ titulo: valor(e) })} {...aria('titulo', errores.titulo)} />
      </Campo>

      {esEvento && (
        <label class="opcion">
          <input type="checkbox" checked={b.todoElDia} onChange={(e) => cambiar({ todoElDia: (e.currentTarget as HTMLInputElement).checked })} />
          {t('calendario.campo.todoElDia')}
        </label>
      )}

      <div class="cal-dos-columnas">
        {b.todoElDia ? (
          <>
            <Campo campo="inicio" etiqueta={t('calendario.campo.primerDia')} error={errores.inicio}>
              <input
                type="date"
                value={b.primerDia}
                onInput={(e) => {
                  const v = valor(e);
                  cambiar({ primerDia: v, ...(b.ultimoDia < v ? { ultimoDia: v } : {}) });
                }}
                {...aria('inicio', errores.inicio)}
              />
            </Campo>
            <Campo campo="fin" etiqueta={t('calendario.campo.ultimoDia')} error={errores.fin}>
              <input type="date" value={b.ultimoDia} min={b.primerDia} onInput={(e) => cambiar({ ultimoDia: valor(e) })} {...aria('fin', errores.fin)} />
            </Campo>
          </>
        ) : (
          <>
            <Campo campo="inicio" etiqueta={t('calendario.campo.inicio')} ayuda={t('calendario.campo.horaAyuda')} error={errores.inicio}>
              <input type="datetime-local" value={b.inicioLocal} onInput={(e) => cambiarInicio(valor(e))} {...aria('inicio', errores.inicio, true)} />
            </Campo>
            <Campo campo="fin" etiqueta={t('calendario.campo.fin')} error={errores.fin}>
              <input type="datetime-local" value={b.finLocal} min={b.inicioLocal} onInput={(e) => cambiar({ finLocal: valor(e) })} {...aria('fin', errores.fin)} />
            </Campo>
          </>
        )}
      </div>

      <Campo campo="lugar" etiqueta={t('calendario.campo.lugar')} error={errores.lugar}>
        <input value={b.lugar} maxLength={LUGAR_MAX} onInput={(e) => cambiar({ lugar: valor(e) })} {...aria('lugar', errores.lugar)} />
      </Campo>
      <Campo campo="notas" etiqueta={t('calendario.campo.notas')} error={errores.notas}>
        <textarea rows={3} value={b.notas} maxLength={NOTAS_MAX} onInput={(e) => cambiar({ notas: (e.currentTarget as HTMLTextAreaElement).value })} {...aria('notas', errores.notas)} />
      </Campo>

      {esEvento && (
        <>
          <fieldset class="grupo grupo--en-linea">
            <legend>{t('calendario.campo.color')}</legend>
            {COLORES_CATEGORICOS.map((c) => (
              <label key={c} class="opcion" data-color={c}>
                <input type="radio" name="calendario-color" checked={b.color === c} onChange={() => cambiar({ color: c })} />
                <span class="marca-color" aria-hidden="true" />
                {t(`calendario.color.${c}`)}
              </label>
            ))}
          </fieldset>

          <fieldset class="grupo pila" aria-describedby={errores.recurrencia ? 'calendario-recurrencia-error' : undefined}>
            <legend>{t('calendario.campo.repetir')}</legend>
            <Campo campo="repetir" etiqueta={t('calendario.campo.repetir')} clase="campo oculto-etiqueta">
              <select
                id={idDeControl('repetir')}
                value={b.repetir}
                onChange={(e) => {
                  const r = (e.currentTarget as HTMLSelectElement).value as Borrador['repetir'];
                  cambiar({ repetir: r, ...(r === 'semanal' && b.dias.length === 0 && fechaInicio ? { dias: [diaSemana(fechaInicio)] } : {}) });
                }}
              >
                <option value="no">{t('calendario.repetir.no')}</option>
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {t(`calendario.repetir.${f}`)}
                  </option>
                ))}
              </select>
            </Campo>
            {b.repetir !== 'no' && (
              <>
                <div class="fila cal-fila-corta">
                  <label for={idDeControl('intervalo')}>{t('calendario.campo.cada')}</label>
                  <input id={idDeControl('intervalo')} class="cal-numero" type="number" inputMode="numeric" min={1} max={INTERVALO_MAX} value={b.intervalo} onInput={(e) => cambiar({ intervalo: valor(e) })} />
                  <span>{t(`calendario.unidad.${b.repetir}`)}</span>
                </div>
                {b.repetir === 'semanal' && (
                  <fieldset class="grupo grupo--en-linea cal-dias">
                    <legend>{t('calendario.diaDeLaSemana')}</legend>
                    {DIAS_SEMANA.map((d) => (
                      <label key={d} class="opcion">
                        <input
                          type="checkbox"
                          checked={b.dias.includes(d)}
                          onChange={(e) => cambiar({ dias: (e.currentTarget as HTMLInputElement).checked ? [...b.dias, d].sort() : b.dias.filter((x) => x !== d) })}
                        />
                        <span aria-hidden="true">{t(`calendario.diaCorto.${d}`)}</span>
                        <span class="oculto-visualmente">{t(`calendario.dia.${d}`)}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {b.repetir === 'mensual' && <p class="campo__ayuda">{t('calendario.mensualAyuda')}</p>}
                <fieldset class="grupo pila">
                  <legend>{t('calendario.campo.termina')}</legend>
                  <label class="opcion">
                    <input type="radio" name="calendario-termina" checked={b.termina === 'nunca'} onChange={() => cambiar({ termina: 'nunca' })} />
                    {t('calendario.termina.nunca')}
                  </label>
                  <div class="fila cal-fila-corta">
                    <label class="opcion">
                      <input type="radio" name="calendario-termina" checked={b.termina === 'fecha'} onChange={() => cambiar({ termina: 'fecha', hasta: b.hasta || fechaInicio })} />
                      {t('calendario.termina.fecha')}
                    </label>
                    <input type="date" aria-label={t('calendario.termina.fecha')} value={b.hasta} min={fechaInicio} disabled={b.termina !== 'fecha'} onInput={(e) => cambiar({ hasta: valor(e) })} />
                  </div>
                  <div class="fila cal-fila-corta">
                    <label class="opcion">
                      <input type="radio" name="calendario-termina" checked={b.termina === 'conteo'} onChange={() => cambiar({ termina: 'conteo' })} />
                      {t('calendario.termina.conteo')}
                    </label>
                    <input class="cal-numero" type="number" inputMode="numeric" min={1} max={CONTEO_MAX} aria-label={t('calendario.termina.veces')} value={b.veces} disabled={b.termina !== 'conteo'} onInput={(e) => cambiar({ veces: valor(e) })} />
                    <span>{t('calendario.termina.veces')}</span>
                  </div>
                </fieldset>
              </>
            )}
            <ErrorDeCampo campo="recurrencia" error={errores.recurrencia} />
          </fieldset>

          <fieldset class="grupo pila" aria-describedby={errores.recordatorios ? 'calendario-recordatorios-error' : undefined}>
            <legend>{t('calendario.campo.recordatorios')}</legend>
            <div class="grupo--en-linea">
              {PRESETS.map((m) => (
                <label key={m} class="opcion">
                  <input
                    type="checkbox"
                    checked={b.recordatorios.includes(m)}
                    disabled={!b.recordatorios.includes(m) && b.recordatorios.length >= RECORDATORIOS_MAX}
                    onChange={(e) => alternarRecordatorio(m, (e.currentTarget as HTMLInputElement).checked)}
                  />
                  {t(`calendario.recordatorio.${m}`)}
                </label>
              ))}
            </div>
            {personalizados.length > 0 && (
              <ul class="cal-chips">
                {personalizados.map((m) => (
                  <li key={m}>
                    <span>{textoDeRecordatorio(ctx, m)}</span>
                    <button type="button" class="boton" aria-label={t('calendario.recordatorio.quitar', { texto: textoDeRecordatorio(ctx, m) })} onClick={() => alternarRecordatorio(m, false)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div class="fila cal-fila-corta">
              <span>{t('calendario.recordatorio.otro')}</span>
              <input class="cal-numero" type="number" inputMode="numeric" min={1} aria-label={t('calendario.recordatorio.cantidad')} value={otroN} onInput={(e) => setOtroN(valor(e))} />
              <select aria-label={t('calendario.recordatorio.unidad')} value={otroUnidad} onChange={(e) => setOtroUnidad((e.currentTarget as HTMLSelectElement).value as '1' | '60' | '1440')}>
                <option value="1">min</option>
                <option value="60">h</option>
                <option value="1440">{t('calendario.unidad.diaria')}</option>
              </select>
              <button
                type="button"
                class="boton"
                disabled={b.recordatorios.length >= RECORDATORIOS_MAX}
                onClick={() => {
                  const m = Math.round(Number(otroN) * Number(otroUnidad));
                  if (Number.isFinite(m) && m >= 0 && m <= RECORDATORIO_MAX_MIN) alternarRecordatorio(m, true);
                  else setErrores((x) => ({ ...x, recordatorios: t('calendario.error.recordatorio') }));
                }}
              >
                {t('calendario.recordatorio.agregar')}
              </button>
            </div>
            {b.todoElDia && <p class="campo__ayuda">{t('calendario.recordatorio.todoElDiaAyuda')}</p>}
            <ErrorDeCampo campo="recordatorios" error={errores.recordatorios} />
            <GarantiasDeAviso ctx={ctx} />
          </fieldset>

          <div class="campo">
            <label class="opcion">
              <input
                type="checkbox"
                checked={b.compromiso && !b.todoElDia}
                disabled={b.todoElDia}
                onChange={(e) => cambiar({ compromiso: (e.currentTarget as HTMLInputElement).checked })}
                {...aria('compromiso', errores.compromiso, true)}
              />
              ☆ {t('calendario.campo.compromiso')}
            </label>
            <Ayuda campo="compromiso">{t('calendario.campo.compromisoAyuda')}</Ayuda>
            <ErrorDeCampo campo="compromiso" error={errores.compromiso} />
          </div>
        </>
      )}

      {extra}

      <div class="acciones">
        <button type="submit" class="boton boton--primario" disabled={guardando}>
          {textoGuardar}
        </button>
        <a class="boton" href={hrefDe(volverA)}>
          {t('calendario.cancelar')}
        </a>
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}

/** Datos de ocurrencia desde los datos completos del formulario (modo `ocurrencia`). */
export const aDatosDeOcurrencia = (d: DatosDeEvento): DatosDeOcurrencia => ({ titulo: d.titulo, lugar: d.lugar, notas: d.notas, inicio: d.inicio, fin: d.fin });

export type { EventoDeCalendario };
