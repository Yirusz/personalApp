/**
 * Expansión de un evento en ocurrencias dentro de un rango. Nada se guarda:
 * se calcula cada vez para lo que se ve (agenda, día, semana, mes, avisos).
 */
import { MS_DIA, type Zona } from '../../../nucleo/dominio/zona-horaria';
import type { EventoDeCalendario } from './evento';
import { diferenciaDias, sumarDias } from './fechas';
import { esOcurrencia, fechasDeOcurrencia } from './recurrencia';
import { porInicio, seSolapa, type Ocurrencia, type Rango } from './visible';

const base = (e: EventoDeCalendario, zona: Zona) => (e.todoElDia ? e.inicio : zona.aCivil(Date.parse(e.inicio)).fecha);

/** La ocurrencia de fecha original `clave` (aplicando su excepción), o `null` si fue cancelada. No valida la clave. */
export function instanciar(e: EventoDeCalendario, clave: string, zona: Zona): Ocurrencia | null {
  const ex = e.excepciones[clave];
  if (ex?.cancelada) return null;
  const modificada = ex !== undefined && !ex.cancelada;
  const inicio = modificada ? ex.inicio : e.inicio;
  const fin = modificada ? ex.fin : e.fin;
  let inicioMs: number, finMs: number, fechaInicio: string, fechaFin: string;
  if (e.todoElDia) {
    fechaInicio = modificada ? inicio : clave;
    fechaFin = modificada ? fin : sumarDias(clave, diferenciaDias(e.inicio, e.fin));
    inicioMs = zona.aUtc(fechaInicio);
    finMs = zona.aUtc(sumarDias(fechaFin, 1));
  } else {
    if (modificada) {
      inicioMs = Date.parse(inicio);
      finMs = Date.parse(fin);
    } else {
      const minutos = zona.aCivil(Date.parse(e.inicio)).minutos;
      inicioMs = zona.aUtc(clave, minutos);
      finMs = inicioMs + (Date.parse(e.fin) - Date.parse(e.inicio));
    }
    fechaInicio = zona.aCivil(inicioMs).fecha;
    fechaFin = zona.aCivil(finMs - 1).fecha;
  }
  return {
    fuente: 'propio',
    id: `${e.id}|${clave}`,
    eventoId: e.id,
    clave,
    titulo: modificada ? ex.titulo : e.titulo,
    lugar: modificada ? ex.lugar : e.lugar,
    notas: modificada ? ex.notas : e.notas,
    color: e.color,
    todoElDia: e.todoElDia,
    inicioMs,
    finMs,
    fechaInicio,
    fechaFin,
    puntual: false,
    hecho: false,
    recurrente: e.recurrencia !== null,
    modificada,
    compromiso: e.compromiso,
    cumplida: e.cumplidas.includes(clave),
    recordatorios: e.recordatorios,
  };
}

export function ocurrenciasEnRango(e: EventoDeCalendario, rango: Rango, zona: Zona): Ocurrencia[] {
  const fechaBase = base(e, zona);
  const duracion = e.todoElDia ? (diferenciaDias(e.inicio, e.fin) + 1) * MS_DIA : Date.parse(e.fin) - Date.parse(e.inicio);
  // Se amplía hacia atrás por la duración: una ocurrencia que empezó antes puede seguir visible.
  const desde = zona.aCivil(rango.desdeMs - duracion - MS_DIA).fecha;
  const hasta = zona.aCivil(rango.hastaMs).fecha;
  const claves = e.recurrencia ? fechasDeOcurrencia(fechaBase, e.recurrencia, desde, hasta) : fechaBase >= desde && fechaBase <= hasta ? [fechaBase] : [];
  const vistas = new Set(claves);
  const resultado: Ocurrencia[] = [];
  const agregar = (clave: string) => {
    const o = instanciar(e, clave, zona);
    if (o && seSolapa(o, rango)) resultado.push(o);
  };
  for (const clave of claves) agregar(clave);
  // Ocurrencias movidas (editadas) cuya fecha original quedó fuera de la ventana pero que ahora caen dentro.
  if (e.recurrencia) {
    for (const [clave, ex] of Object.entries(e.excepciones)) {
      if (vistas.has(clave) || ex.cancelada || !esOcurrencia(fechaBase, e.recurrencia, clave)) continue;
      agregar(clave);
    }
  }
  return resultado.sort(porInicio);
}
