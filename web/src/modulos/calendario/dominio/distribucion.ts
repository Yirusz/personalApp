/** Cálculos puros de las vistas: días de la agenda, columnas de la cuadrícula horaria y cuadrícula del mes. */
import { MS_MINUTO, type Zona } from '../../../nucleo/dominio/zona-horaria';
import { componentes, diasDelMes, fechaConDia, inicioDeSemana, sumarDias } from './fechas';
import { porInicio, type ElementoVisible, type Rango } from './visible';

/** Instantes de [desde 00:00, desde + dias 00:00) en la zona. */
export function rangoDeDias(desde: string, dias: number, zona: Zona): Rango {
  return { desdeMs: zona.aUtc(desde), hastaMs: zona.aUtc(sumarDias(desde, dias)) };
}

export interface Dia {
  fecha: string;
  todoElDia: ElementoVisible[];
  conHora: ElementoVisible[];
}

/** Agrupa por día local. Lo que dura varios días aparece en cada uno. */
export function agruparPorDia(elementos: readonly ElementoVisible[], desde: string, dias: number, zona: Zona): Dia[] {
  const resultado: Dia[] = Array.from({ length: dias }, (_, i) => ({ fecha: sumarDias(desde, i), todoElDia: [], conHora: [] }));
  const porFecha = new Map(resultado.map((d) => [d.fecha, d]));
  for (const e of [...elementos].sort(porInicio)) {
    const primera = e.todoElDia ? e.fechaInicio : zona.aCivil(e.inicioMs).fecha;
    const ultima = e.todoElDia || !e.puntual ? e.fechaFin : primera;
    for (let f = primera; f <= ultima; f = sumarDias(f, 1)) {
      const dia = porFecha.get(f);
      if (dia) (e.todoElDia ? dia.todoElDia : dia.conHora).push(e);
    }
  }
  return resultado;
}

export interface Posicion {
  elemento: ElementoVisible;
  /** Minutos desde la medianoche local (0–1440), recortados al día. */
  desdeMinuto: number;
  hastaMinuto: number;
  columna: number;
  columnas: number;
}

/** Duración mínima visual (min) para que algo corto o puntual se pueda ver y tocar. */
export const MINUTOS_MINIMOS_VISIBLES = 30;

/** Posiciones en la cuadrícula horaria de un día: los solapados se reparten en columnas. */
export function columnasDelDia(elementos: readonly ElementoVisible[], fecha: string, zona: Zona): Posicion[] {
  const inicioDia = zona.aUtc(fecha);
  const finDia = zona.aUtc(sumarDias(fecha, 1));
  const minutosDelDia = (finDia - inicioDia) / MS_MINUTO;
  const posiciones: Posicion[] = elementos
    .filter((e) => !e.todoElDia && (e.puntual ? e.inicioMs >= inicioDia && e.inicioMs < finDia : e.inicioMs < finDia && e.finMs > inicioDia))
    .map((e) => {
      const desdeMinuto = Math.max(0, Math.round((e.inicioMs - inicioDia) / MS_MINUTO));
      const hastaReal = Math.min(minutosDelDia, Math.round((e.finMs - inicioDia) / MS_MINUTO));
      return { elemento: e, desdeMinuto, hastaMinuto: Math.max(hastaReal, desdeMinuto), columna: 0, columnas: 1 };
    })
    .sort((a, b) => a.desdeMinuto - b.desdeMinuto || b.hastaMinuto - a.hastaMinuto || a.elemento.id.localeCompare(b.elemento.id));

  const finVisual = (p: Posicion) => Math.max(p.hastaMinuto, p.desdeMinuto + MINUTOS_MINIMOS_VISIBLES);
  let grupo: Posicion[] = [];
  let finesDeColumna: number[] = [];
  let finDelGrupo = -1;
  const cerrar = () => {
    for (const p of grupo) p.columnas = finesDeColumna.length;
    grupo = [];
    finesDeColumna = [];
  };
  for (const p of posiciones) {
    if (p.desdeMinuto >= finDelGrupo) cerrar();
    let columna = finesDeColumna.findIndex((fin) => fin <= p.desdeMinuto);
    if (columna === -1) columna = finesDeColumna.push(0) - 1;
    finesDeColumna[columna] = finVisual(p);
    p.columna = columna;
    grupo.push(p);
    finDelGrupo = Math.max(finDelGrupo, finVisual(p));
  }
  cerrar();
  return posiciones;
}

/** Días de la cuadrícula del mes de `fecha`: de lunes a domingo, semanas completas. */
export function cuadriculaDeMes(fecha: string): string[] {
  const { anio, mes } = componentes(fecha);
  const primero = fechaConDia(anio, mes, 1)!;
  const ultimo = fechaConDia(anio, mes, diasDelMes(anio, mes))!;
  const desde = inicioDeSemana(primero);
  const hasta = sumarDias(inicioDeSemana(ultimo), 6);
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}
