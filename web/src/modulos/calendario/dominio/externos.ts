/**
 * Elementos que publican otros módulos (`datos.agenda`, ElementoDeAgenda).
 * Vienen de afuera: se validan y, si están mal formados, se rechazan sin
 * afectar al resto (la proyección los omite y lo anota en Diagnóstico).
 */
import { type ElementoDeAgenda } from '../../../nucleo/dominio/agenda';
import { esColorDeAgenda, type ColorDeAgenda } from '../../../nucleo/dominio/color';
import { esFechaCivil, type Zona } from '../../../nucleo/dominio/zona-horaria';
import { ElementoDeAgendaInvalido } from './errores';
import { sumarDias } from './fechas';
import type { ElementoExterno } from './visible';

const INSTANTE = /^\d{4}-\d{2}-\d{2}T/;
const TIPOS = ['vencimiento', 'evento', 'bloque'];
const ESTADOS = ['pendiente', 'hecho', 'eliminado'];

export function validarElementoDeAgenda(valor: unknown): ElementoDeAgenda & { ruta?: string } {
  const v = valor as Record<string, unknown> | null;
  const malo = (motivo: string) => new ElementoDeAgendaInvalido(`Elemento de agenda inválido: ${motivo}`);
  if (!v || typeof v !== 'object') throw malo('no es un objeto');
  if (typeof v.id !== 'string' || !v.id) throw malo('id');
  if (typeof v.titulo !== 'string') throw malo('titulo');
  const todoElDia = v.todoElDia === true;
  const fechaValida = (x: unknown) => typeof x === 'string' && ((todoElDia && esFechaCivil(x)) || (INSTANTE.test(x) && !Number.isNaN(Date.parse(x))));
  if (!fechaValida(v.inicio)) throw malo('inicio');
  if (v.fin !== undefined && (!fechaValida(v.fin) || String(v.fin) < String(v.inicio))) throw malo('fin');
  if (!TIPOS.includes(v.tipo as string)) throw malo('tipo');
  if (!ESTADOS.includes(v.estado as string)) throw malo('estado');
  return {
    id: v.id,
    titulo: v.titulo.slice(0, 200),
    inicio: v.inicio as string,
    ...(v.fin !== undefined ? { fin: v.fin as string } : {}),
    ...(todoElDia ? { todoElDia } : {}),
    tipo: v.tipo as ElementoDeAgenda['tipo'],
    estado: v.estado as ElementoDeAgenda['estado'],
    ...(esColorDeAgenda(v.color) ? { color: v.color.toLowerCase() as ColorDeAgenda } : {}),
    ...(typeof v.ruta === 'string' && v.ruta.startsWith('/') ? { ruta: v.ruta } : {}),
  };
}

export function elementoExterno(origen: string, valor: unknown, zona: Zona): ElementoExterno {
  const a = validarElementoDeAgenda(valor);
  const todoElDia = a.todoElDia === true;
  let inicioMs: number, finMs: number, fechaInicio: string, fechaFin: string;
  if (todoElDia) {
    fechaInicio = esFechaCivil(a.inicio) ? a.inicio : zona.aCivil(Date.parse(a.inicio)).fecha;
    fechaFin = a.fin ? (esFechaCivil(a.fin) ? a.fin : zona.aCivil(Date.parse(a.fin)).fecha) : fechaInicio;
    inicioMs = zona.aUtc(fechaInicio);
    finMs = zona.aUtc(sumarDias(fechaFin, 1));
  } else {
    inicioMs = Date.parse(a.inicio);
    finMs = a.fin ? Date.parse(a.fin) : inicioMs;
    fechaInicio = zona.aCivil(inicioMs).fecha;
    fechaFin = zona.aCivil(Math.max(inicioMs, finMs - 1)).fecha;
  }
  return {
    fuente: 'externo',
    id: `${origen}:${a.id}`,
    clave: `${origen}:${a.id}`,
    origen,
    titulo: a.titulo,
    ...(a.color ? { color: a.color } : {}),
    ...(a.ruta ? { ruta: a.ruta } : {}),
    todoElDia,
    inicioMs,
    finMs,
    fechaInicio,
    fechaFin,
    puntual: !todoElDia && finMs === inicioMs,
    hecho: a.estado === 'hecho',
  };
}
