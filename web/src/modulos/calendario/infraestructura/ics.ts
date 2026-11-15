/**
 * iCalendar (RFC 5545), subconjunto propio (ADR-0012). Sin dependencias.
 *
 * Lee: VEVENT con UID, SUMMARY, LOCATION, DESCRIPTION, DTSTART, DTEND o DURATION
 * (fecha, UTC, TZID o flotante), RRULE (DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY
 * semanal, BYMONTHDAY igual al día de inicio, UNTIL, COUNT), EXDATE,
 * RECURRENCE-ID (ocurrencias modificadas o canceladas), STATUS:CANCELLED y
 * VALARM con TRIGGER relativo al inicio. Lo demás se ignora o se importa con aviso.
 *
 * Escribe: VCALENDAR 2.0 con horas locales y TZID (más VTIMEZONE si la zona
 * tiene desfase fijo), RRULE, EXDATE, RECURRENCE-ID, VALARM y líneas plegadas a 75 octetos.
 */
import { COLORES_CATEGORICOS, esColorCategorico, type ColorCategorico } from '../../../nucleo/dominio/agenda';
import { crearZona, MS_DIA, MS_MINUTO, tieneDesfaseFijo, type Zona } from '../../../nucleo/dominio/zona-horaria';
import type { DatosDeEvento, EventoDeCalendario, Excepcion } from '../dominio/evento';
import { LUGAR_MAX, NOTAS_MAX, RECORDATORIO_MAX_MIN, RECORDATORIOS_MAX, TITULO_MAX } from '../dominio/evento';
import { sumarDias, type DiaSemana } from '../dominio/fechas';
import { CONTEO_MAX, INTERVALO_MAX, type Recurrencia } from '../dominio/recurrencia';
import type { ElementoExterno } from '../dominio/visible';

// ---------------------------------------------------------------------------
// Tipos del resultado de la lectura
// ---------------------------------------------------------------------------

export interface EventoImportable {
  uid: string;
  datos: DatosDeEvento;
  excepciones: Record<string, Excepcion>;
}

export type MotivoDeAviso =
  | 'repeticionNoSoportada'
  | 'zonaDesconocida'
  | 'sinFecha'
  | 'cancelado'
  | 'uidRepetido'
  | 'ocurrenciaSuelta'
  | 'recordatorioIgnorado'
  | 'textoRecortado';

export interface AvisoDeLectura {
  motivo: MotivoDeAviso;
  titulo: string;
  detalle?: string;
}

export interface ResultadoDeLectura {
  nombre: string | null;
  eventos: EventoImportable[];
  avisos: AvisoDeLectura[];
}

export class ArchivoIcsInvalido extends Error {
  override name = 'ArchivoIcsInvalido';
  readonly clave = 'calendario.ics.error.archivo';
}

// ---------------------------------------------------------------------------
// Líneas de contenido
// ---------------------------------------------------------------------------

interface Propiedad {
  nombre: string;
  parametros: Record<string, string>;
  valor: string;
}

interface Componente {
  tipo: string;
  propiedades: Propiedad[];
  hijos: Componente[];
}

function desplegar(texto: string): string[] {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const resultado: string[] = [];
  for (const linea of lineas) {
    if ((linea.startsWith(' ') || linea.startsWith('\t')) && resultado.length > 0) resultado[resultado.length - 1] += linea.slice(1);
    else if (linea.length > 0) resultado.push(linea);
  }
  return resultado;
}

function analizarLinea(linea: string): Propiedad | null {
  let i = 0;
  while (i < linea.length && linea[i] !== ';' && linea[i] !== ':') i++;
  const nombre = linea.slice(0, i).toUpperCase();
  const parametros: Record<string, string> = {};
  while (linea[i] === ';') {
    const inicio = ++i;
    while (i < linea.length && linea[i] !== '=') i++;
    const clave = linea.slice(inicio, i).toUpperCase();
    i++;
    let valor: string;
    if (linea[i] === '"') {
      const cierre = linea.indexOf('"', i + 1);
      if (cierre === -1) return null;
      valor = linea.slice(i + 1, cierre);
      i = cierre + 1;
      // Lista de valores entre comillas: se conserva solo el primero.
      while (i < linea.length && linea[i] !== ';' && linea[i] !== ':') i++;
    } else {
      const desde = i;
      while (i < linea.length && linea[i] !== ';' && linea[i] !== ':') i++;
      valor = linea.slice(desde, i);
    }
    parametros[clave] = valor;
  }
  if (linea[i] !== ':' || !nombre) return null;
  return { nombre, parametros, valor: linea.slice(i + 1) };
}

function analizar(texto: string): Componente {
  const raiz: Componente = { tipo: 'RAIZ', propiedades: [], hijos: [] };
  const pila: Componente[] = [raiz];
  for (const linea of desplegar(texto.replace(/^\uFEFF/, ''))) {
    const p = analizarLinea(linea);
    if (!p) continue; // línea mal formada: se ignora (tolerante al leer)
    const actual = pila[pila.length - 1]!;
    if (p.nombre === 'BEGIN') {
      const hijo: Componente = { tipo: p.valor.trim().toUpperCase(), propiedades: [], hijos: [] };
      actual.hijos.push(hijo);
      pila.push(hijo);
    } else if (p.nombre === 'END') {
      if (pila.length > 1) pila.pop();
    } else actual.propiedades.push(p);
  }
  const calendario = raiz.hijos.find((c) => c.tipo === 'VCALENDAR');
  if (!calendario) throw new ArchivoIcsInvalido('No es un archivo iCalendar (falta BEGIN:VCALENDAR)');
  return calendario;
}

const primera = (c: Componente, nombre: string) => c.propiedades.find((p) => p.nombre === nombre);
const todas = (c: Componente, nombre: string) => c.propiedades.filter((p) => p.nombre === nombre);

function desescapar(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

// ---------------------------------------------------------------------------
// Fechas y zonas
// ---------------------------------------------------------------------------

/** Algunos nombres de zona de Windows/Outlook frecuentes en Colombia y sus equivalentes IANA. */
const ZONAS_WINDOWS: Readonly<Record<string, string>> = {
  'SA Pacific Standard Time': 'America/Bogota',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Romance Standard Time': 'Europe/Paris',
  'W. Europe Standard Time': 'Europe/Berlin',
  'GMT Standard Time': 'Europe/London',
  UTC: 'UTC',
  'Coordinated Universal Time': 'UTC',
};

function zonaConocida(tzid: string): Zona | null {
  const candidatos = [tzid, ZONAS_WINDOWS[tzid]];
  // Prefijos como "/mozilla.org/20050126_1/America/Bogota".
  const partes = tzid.split('/').filter(Boolean);
  for (let i = 0; i < partes.length - 1; i++) candidatos.push(partes.slice(i).join('/'));
  for (const c of candidatos) {
    if (!c) continue;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: c });
      return crearZona(c);
    } catch {
      // No es una zona IANA conocida por este navegador.
    }
  }
  return null;
}

type Fecha = { tipo: 'fecha'; fecha: string } | { tipo: 'instante'; ms: number };

const PATRON_FECHA = /^(\d{4})(\d{2})(\d{2})$/;
const PATRON_FECHA_HORA = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

interface Contexto {
  zona: Zona;
  avisar: (motivo: MotivoDeAviso, detalle?: string) => void;
}

function leerFecha(valor: string, parametros: Record<string, string>, ctx: Contexto): Fecha | null {
  const v = valor.trim();
  const d = PATRON_FECHA.exec(v);
  if (d) return { tipo: 'fecha', fecha: `${d[1]}-${d[2]}-${d[3]}` };
  const t = PATRON_FECHA_HORA.exec(v);
  if (!t) return null;
  const fecha = `${t[1]}-${t[2]}-${t[3]}`;
  const minutos = Number(t[4]) * 60 + Number(t[5]);
  const segundos = Number(t[6]);
  if (t[7] === 'Z') return { tipo: 'instante', ms: Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3])) + minutos * MS_MINUTO + segundos * 1000 };
  let zona = ctx.zona;
  if (parametros.TZID) {
    const conocida = zonaConocida(parametros.TZID);
    if (conocida) zona = conocida;
    else ctx.avisar('zonaDesconocida', parametros.TZID);
  }
  return { tipo: 'instante', ms: zona.aUtc(fecha, minutos) + segundos * 1000 };
}

function leerDuracion(valor: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(valor.trim());
  if (!m) return null;
  const [, signo, semanas, dias, horas, minutos, segundos] = m;
  const total =
    Number(semanas ?? 0) * 7 * MS_DIA + Number(dias ?? 0) * MS_DIA + Number(horas ?? 0) * 3_600_000 + Number(minutos ?? 0) * MS_MINUTO + Number(segundos ?? 0) * 1000;
  return signo === '-' ? -total : total;
}

/** Fecha civil en la zona del usuario (para claves de ocurrencia y UNTIL). */
const fechaCivil = (f: Fecha, zona: Zona) => (f.tipo === 'fecha' ? f.fecha : zona.aCivil(f.ms).fecha);

// ---------------------------------------------------------------------------
// RRULE
// ---------------------------------------------------------------------------

const DIAS_ICS: Readonly<Record<string, DiaSemana>> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
const ICS_DIAS = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

function leerRrule(valor: string, inicioCivil: string, ctx: Contexto): Recurrencia | 'no-soportada' {
  const partes = Object.fromEntries(
    valor
      .split(';')
      .map((p) => p.split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k!.toUpperCase(), v!.toUpperCase()]),
  );
  const frecuencias: Record<string, Recurrencia['frecuencia']> = { DAILY: 'diaria', WEEKLY: 'semanal', MONTHLY: 'mensual' };
  const frecuencia = frecuencias[partes.FREQ ?? ''];
  if (!frecuencia) return 'no-soportada';
  const soportadas = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'UNTIL', 'COUNT', 'WKST']);
  if (Object.keys(partes).some((k) => !soportadas.has(k))) return 'no-soportada';
  const intervalo = partes.INTERVAL ? Number(partes.INTERVAL) : 1;
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > INTERVALO_MAX) return 'no-soportada';

  let dias: DiaSemana[] = [];
  if (partes.BYDAY) {
    if (frecuencia !== 'semanal') return 'no-soportada';
    const lista = partes.BYDAY.split(',');
    if (lista.some((d) => !(d in DIAS_ICS))) return 'no-soportada'; // ordinales (2MO) no
    dias = lista.map((d) => DIAS_ICS[d]!);
  } else if (frecuencia === 'semanal') {
    const d = new Date(`${inicioCivil}T00:00:00Z`).getUTCDay();
    dias = [(d === 0 ? 7 : d) as DiaSemana];
  }
  if (partes.BYMONTHDAY && (frecuencia !== 'mensual' || Number(partes.BYMONTHDAY) !== Number(inicioCivil.slice(8)))) return 'no-soportada';

  let fin: Recurrencia['fin'] = { tipo: 'nunca' };
  if (partes.UNTIL) {
    const f = leerFecha(partes.UNTIL, {}, ctx);
    if (!f) return 'no-soportada';
    fin = { tipo: 'fecha', hasta: fechaCivil(f, ctx.zona) };
  } else if (partes.COUNT) {
    const n = Number(partes.COUNT);
    if (!Number.isInteger(n) || n < 1) return 'no-soportada';
    fin = { tipo: 'conteo', veces: Math.min(n, CONTEO_MAX) };
  }
  return { frecuencia, intervalo, dias, fin };
}

function escribirRrule(r: Recurrencia, todoElDia: boolean, zona: Zona): string {
  const freq = { diaria: 'DAILY', semanal: 'WEEKLY', mensual: 'MONTHLY' }[r.frecuencia];
  const partes = [`FREQ=${freq}`];
  if (r.intervalo > 1) partes.push(`INTERVAL=${r.intervalo}`);
  if (r.frecuencia === 'semanal') partes.push(`BYDAY=${r.dias.map((d) => ICS_DIAS[d]).join(',')}`);
  if (r.fin.tipo === 'conteo') partes.push(`COUNT=${r.fin.veces}`);
  if (r.fin.tipo === 'fecha') {
    // RFC 5545: con DTSTART en hora local con TZID, UNTIL va en UTC. Inclusivo hasta el final del día local.
    partes.push(`UNTIL=${todoElDia ? r.fin.hasta.replaceAll('-', '') : utc(zona.aUtc(sumarDias(r.fin.hasta, 1)) - 1000)}`);
  }
  return partes.join(';');
}

// ---------------------------------------------------------------------------
// Lectura de eventos
// ---------------------------------------------------------------------------

function recortar(texto: string, max: number, ctx: Contexto): string {
  if (texto.length <= max) return texto;
  ctx.avisar('textoRecortado');
  return texto.slice(0, max);
}

function leerAlarmas(ev: Componente, ctx: Contexto): number[] {
  const minutos: number[] = [];
  for (const alarma of ev.hijos.filter((h) => h.tipo === 'VALARM')) {
    const trigger = primera(alarma, 'TRIGGER');
    const ms = trigger && trigger.parametros.VALUE !== 'DATE-TIME' && trigger.parametros.RELATED !== 'END' ? leerDuracion(trigger.valor) : null;
    const m = ms === null ? NaN : Math.round(-ms / MS_MINUTO);
    if (Number.isInteger(m) && m >= 0 && m <= RECORDATORIO_MAX_MIN) minutos.push(m);
    else ctx.avisar('recordatorioIgnorado');
  }
  const unicos = [...new Set(minutos)].sort((a, b) => a - b);
  if (unicos.length > RECORDATORIOS_MAX) ctx.avisar('recordatorioIgnorado');
  return unicos.slice(0, RECORDATORIOS_MAX);
}

interface Basico {
  titulo: string;
  lugar: string;
  notas: string;
  todoElDia: boolean;
  inicio: string;
  fin: string;
  inicioFecha: Fecha;
}

function leerBasico(ev: Componente, ctx: Contexto): Basico | null {
  const titulo = recortar(desescapar(primera(ev, 'SUMMARY')?.valor ?? '').trim() || '(Sin título)', TITULO_MAX, ctx);
  const lugar = recortar(desescapar(primera(ev, 'LOCATION')?.valor ?? '').trim(), LUGAR_MAX, ctx);
  const notas = recortar(desescapar(primera(ev, 'DESCRIPTION')?.valor ?? '').trim(), NOTAS_MAX, ctx);
  const pInicio = primera(ev, 'DTSTART');
  const inicio = pInicio ? leerFecha(pInicio.valor, pInicio.parametros, ctx) : null;
  if (!inicio) return null;
  const pFin = primera(ev, 'DTEND');
  const fin = pFin ? leerFecha(pFin.valor, pFin.parametros, ctx) : null;
  const duracion = primera(ev, 'DURATION') ? leerDuracion(primera(ev, 'DURATION')!.valor) : null;

  if (inicio.tipo === 'fecha') {
    // DTEND de fecha es exclusivo; el dominio guarda el último día (inclusivo).
    let ultimo = inicio.fecha;
    if (fin) ultimo = sumarDias(fechaCivil(fin, ctx.zona), fin.tipo === 'fecha' ? -1 : 0);
    else if (duracion !== null && duracion > 0) ultimo = sumarDias(inicio.fecha, Math.ceil(duracion / MS_DIA) - 1);
    if (ultimo < inicio.fecha) ultimo = inicio.fecha;
    return { titulo, lugar, notas, todoElDia: true, inicio: inicio.fecha, fin: ultimo, inicioFecha: inicio };
  }
  let finMs = fin ? (fin.tipo === 'fecha' ? ctx.zona.aUtc(fin.fecha) : fin.ms) : duracion !== null ? inicio.ms + duracion : inicio.ms;
  // Sin duración (p. ej. vencimientos de Moodle con DTSTART = DTEND): 30 min para que se vea.
  if (finMs <= inicio.ms) finMs = inicio.ms + 30 * MS_MINUTO;
  return { titulo, lugar, notas, todoElDia: false, inicio: utcIso(inicio.ms), fin: utcIso(finMs), inicioFecha: inicio };
}

function colorDe(ev: Componente, porDefecto: ColorCategorico): ColorCategorico {
  const propio = primera(ev, 'X-LUDUS-COLOR')?.valor.trim().toLowerCase();
  return esColorCategorico(propio) ? propio : porDefecto;
}

/** Lee un archivo .ics. Tolerante: lo que no entiende lo omite y lo explica en `avisos`. */
export function leerIcs(texto: string, zona: Zona, colorPorDefecto: ColorCategorico = 'azul'): ResultadoDeLectura {
  const calendario = analizar(texto);
  const avisos: AvisoDeLectura[] = [];
  const nombre = primera(calendario, 'X-WR-CALNAME') ? desescapar(primera(calendario, 'X-WR-CALNAME')!.valor) : null;
  const vevents = calendario.hijos.filter((c) => c.tipo === 'VEVENT');
  const maestros = vevents.filter((v) => !primera(v, 'RECURRENCE-ID'));
  const sueltas = vevents.filter((v) => primera(v, 'RECURRENCE-ID'));
  const porUid = new Map<string, EventoImportable>();
  let anonimos = 0;

  for (const ev of maestros) {
    const tituloCrudo = desescapar(primera(ev, 'SUMMARY')?.valor ?? '').trim() || '(Sin título)';
    const ctx: Contexto = { zona, avisar: (motivo, detalle) => avisos.push({ motivo, titulo: tituloCrudo, ...(detalle ? { detalle } : {}) }) };
    if (primera(ev, 'STATUS')?.valor.toUpperCase() === 'CANCELLED') {
      ctx.avisar('cancelado');
      continue;
    }
    const b = leerBasico(ev, ctx);
    if (!b) {
      ctx.avisar('sinFecha');
      continue;
    }
    const uid = primera(ev, 'UID')?.valor.trim() || `sin-uid-${++anonimos}-${b.inicio}@importado`;
    if (porUid.has(uid)) ctx.avisar('uidRepetido', uid);

    let recurrencia: Recurrencia | null = null;
    const rrule = primera(ev, 'RRULE');
    if (rrule) {
      const r = leerRrule(rrule.valor, fechaCivil(b.inicioFecha, zona), ctx);
      if (r === 'no-soportada') ctx.avisar('repeticionNoSoportada', rrule.valor);
      else recurrencia = r;
    }
    const excepciones: Record<string, Excepcion> = {};
    if (recurrencia) {
      for (const p of todas(ev, 'EXDATE')) {
        for (const v of p.valor.split(',')) {
          const f = leerFecha(v, p.parametros, ctx);
          if (f) excepciones[fechaCivil(f, zona)] = { cancelada: true };
        }
      }
    }
    porUid.set(uid, {
      uid,
      datos: {
        titulo: b.titulo,
        lugar: b.lugar,
        notas: b.notas,
        color: colorDe(ev, colorPorDefecto),
        todoElDia: b.todoElDia,
        inicio: b.inicio,
        fin: b.fin,
        recordatorios: leerAlarmas(ev, ctx),
        recurrencia,
        compromiso: primera(ev, 'X-LUDUS-COMPROMISO')?.valor.trim().toUpperCase() === 'TRUE',
      },
      excepciones,
    });
  }

  for (const ev of sueltas) {
    const tituloCrudo = desescapar(primera(ev, 'SUMMARY')?.valor ?? '').trim() || '(Sin título)';
    const ctx: Contexto = { zona, avisar: (motivo, detalle) => avisos.push({ motivo, titulo: tituloCrudo, ...(detalle ? { detalle } : {}) }) };
    const uid = primera(ev, 'UID')?.valor.trim() ?? '';
    const maestro = porUid.get(uid);
    const rid = primera(ev, 'RECURRENCE-ID')!;
    const original = leerFecha(rid.valor, rid.parametros, ctx);
    if (!maestro || !maestro.datos.recurrencia || !original) {
      ctx.avisar('ocurrenciaSuelta');
      continue;
    }
    const clave = fechaCivil(original, zona);
    if (primera(ev, 'STATUS')?.valor.toUpperCase() === 'CANCELLED') {
      maestro.excepciones[clave] = { cancelada: true };
      continue;
    }
    const b = leerBasico(ev, ctx);
    if (!b || b.todoElDia !== maestro.datos.todoElDia) {
      ctx.avisar('ocurrenciaSuelta');
      continue;
    }
    maestro.excepciones[clave] = { cancelada: false, titulo: b.titulo, lugar: b.lugar, notas: b.notas, inicio: b.inicio, fin: b.fin };
  }

  return { nombre, eventos: [...porUid.values()], avisos };
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

const utcIso = (ms: number) => new Date(ms).toISOString();
const dos = (n: number) => String(n).padStart(2, '0');

function utc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}${dos(d.getUTCSeconds())}Z`;
}

function local(ms: number, zona: Zona): string {
  const { fecha, minutos } = zona.aCivil(ms);
  const segundos = Math.floor((ms % MS_MINUTO) / 1000);
  return `${fecha.replaceAll('-', '')}T${dos(Math.floor(minutos / 60))}${dos(minutos % 60)}${dos(segundos)}`;
}

function escapar(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Pliega a 75 octetos sin partir caracteres UTF-8. */
function plegar(linea: string): string {
  const codificador = new TextEncoder();
  if (codificador.encode(linea).length <= 75) return linea;
  const trozos: string[] = [];
  let actual = '';
  let bytes = 0;
  for (const caracter of linea) {
    const n = codificador.encode(caracter).length;
    const limite = trozos.length === 0 ? 75 : 74; // las de continuación empiezan con un espacio
    if (bytes + n > limite) {
      trozos.push(actual);
      actual = '';
      bytes = 0;
    }
    actual += caracter;
    bytes += n;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

function vtimezone(zona: Zona, anio: number): string[] {
  const desfase = zona.desfase(Date.UTC(anio, 0, 15)) / MS_MINUTO;
  const signo = desfase < 0 ? '-' : '+';
  const abs = Math.abs(desfase);
  const hhmm = `${signo}${dos(Math.floor(abs / 60))}${dos(abs % 60)}`;
  return ['BEGIN:VTIMEZONE', `TZID:${zona.nombre}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${hhmm}`, `TZOFFSETTO:${hhmm}`, `TZNAME:${hhmm.slice(0, 3)}`, 'END:STANDARD', 'END:VTIMEZONE'];
}

function lineasDeFecha(nombre: string, valor: string, todoElDia: boolean, zona: Zona, esFin = false): string {
  if (todoElDia) return `${nombre};VALUE=DATE:${(esFin ? sumarDias(valor, 1) : valor).replaceAll('-', '')}`;
  return `${nombre};TZID=${zona.nombre}:${local(Date.parse(valor), zona)}`;
}

/** Instante local de la ocurrencia ORIGINAL de fecha `clave` (para EXDATE y RECURRENCE-ID). */
function lineaDeOcurrencia(nombre: string, e: EventoDeCalendario, clave: string, zona: Zona): string {
  if (e.todoElDia) return `${nombre};VALUE=DATE:${clave.replaceAll('-', '')}`;
  const minutos = zona.aCivil(Date.parse(e.inicio)).minutos;
  return `${nombre};TZID=${zona.nombre}:${local(zona.aUtc(clave, minutos), zona)}`;
}

function textos(t: { titulo: string; lugar: string; notas: string }): string[] {
  return [`SUMMARY:${escapar(t.titulo)}`, ...(t.lugar ? [`LOCATION:${escapar(t.lugar)}`] : []), ...(t.notas ? [`DESCRIPTION:${escapar(t.notas)}`] : [])];
}

function alarmas(titulo: string, recordatorios: readonly number[]): string[] {
  return recordatorios.flatMap((m) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(titulo)}`, `TRIGGER:-PT${m}M`, 'END:VALARM']);
}

export interface OpcionesDeEscritura {
  nombre?: string;
  externos?: readonly ElementoExterno[];
}

export function escribirIcs(eventos: readonly EventoDeCalendario[], zona: Zona, ahora: Date, opciones: OpcionesDeEscritura = {}): string {
  const sello = `DTSTAMP:${utc(ahora.getTime())}`;
  const anio = ahora.getUTCFullYear();
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ludus//Calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(opciones.nombre ?? 'Ludus')}`,
    `X-WR-TIMEZONE:${zona.nombre}`,
    ...(tieneDesfaseFijo(zona, anio) ? vtimezone(zona, anio) : []),
  ];

  for (const e of eventos) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      sello,
      `LAST-MODIFIED:${utc(Date.parse(e.actualizadoEn))}`,
      lineasDeFecha('DTSTART', e.inicio, e.todoElDia, zona),
      lineasDeFecha('DTEND', e.fin, e.todoElDia, zona, true),
      ...textos(e),
      `X-LUDUS-COLOR:${e.color}`,
      ...(e.compromiso ? ['X-LUDUS-COMPROMISO:TRUE'] : []),
    );
    if (e.recurrencia) {
      lineas.push(`RRULE:${escribirRrule(e.recurrencia, e.todoElDia, zona)}`);
      for (const [clave, ex] of Object.entries(e.excepciones)) if (ex.cancelada) lineas.push(lineaDeOcurrencia('EXDATE', e, clave, zona));
    }
    lineas.push(...alarmas(e.titulo, e.recordatorios), 'END:VEVENT');

    if (!e.recurrencia) continue;
    for (const [clave, ex] of Object.entries(e.excepciones)) {
      if (ex.cancelada) continue;
      lineas.push(
        'BEGIN:VEVENT',
        `UID:${e.uid}`,
        sello,
        lineaDeOcurrencia('RECURRENCE-ID', e, clave, zona),
        lineasDeFecha('DTSTART', ex.inicio, e.todoElDia, zona),
        lineasDeFecha('DTEND', ex.fin, e.todoElDia, zona, true),
        ...textos(ex),
        ...alarmas(ex.titulo, e.recordatorios),
        'END:VEVENT',
      );
    }
  }

  for (const x of opciones.externos ?? []) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${x.clave.replace(/[^\w.:-]/g, '_')}@ludus`,
      sello,
      ...(x.todoElDia
        ? [`DTSTART;VALUE=DATE:${x.fechaInicio.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${sumarDias(x.fechaFin, 1).replaceAll('-', '')}`]
        : [`DTSTART:${utc(x.inicioMs)}`, `DTEND:${utc(Math.max(x.finMs, x.inicioMs))}`]),
      `SUMMARY:${escapar(`${x.hecho ? '✓ ' : ''}${x.titulo}`)}`,
      `CATEGORIES:${escapar(x.origen)}`,
      ...(x.color ? [`X-LUDUS-COLOR:${x.color}`] : []),
      'END:VEVENT',
    );
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** Para pruebas y la UI: colores aceptados en X-LUDUS-COLOR. */
export const COLORES_ICS = COLORES_CATEGORICOS;
