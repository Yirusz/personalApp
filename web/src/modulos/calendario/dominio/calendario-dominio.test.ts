/**
 * Reglas de dominio del Calendario (historias CA1–CA12 de la iteración 2).
 * Zona: America/Bogota (UTC−5, sin horario de verano). Una prueba usa Madrid
 * para cubrir el horario de verano con la misma lógica.
 */
import { describe, expect, it } from 'vitest';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import { avisosEntre, avisosPendientes } from './recordatorios';
import { agruparPorDia, columnasDelDia, cuadriculaDeMes } from './distribucion';
import {
  cancelarOcurrencia,
  crearEvento,
  editarEvento,
  editarOcurrencia,
  marcarCumplida,
  restaurarOcurrencia,
  type DatosDeEvento,
  type EventoDeCalendario,
} from './evento';
import { ocurrenciasEnRango } from './expansion';
import { diaSemana, inicioDeSemana, semanaIso, sumarDias, sumarMeses } from './fechas';
import { fechasDeOcurrencia, validarRecurrencia, type Recurrencia } from './recurrencia';
import { ElementoDeAgendaInvalido, elementoExterno } from './externos';
import {
  CompromisoInvalido,
  DuracionExcesiva,
  FinAntesDeInicio,
  OcurrenciaInexistente,
  RecordatorioInvalido,
  RecurrenciaInvalida,
  TituloDeEventoInvalido,
  CumplimientoFueraDeTiempo,
  FechaDeEventoInvalida,
} from './errores';

const BOGOTA = crearZona('America/Bogota');
const AHORA = new Date('2026-11-15T15:00:00Z'); // domingo 15 nov, 10:00 en Bogotá
const ms = (iso: string) => Date.parse(iso);
const hora = (iso: string) => BOGOTA.aCivil(ms(iso));

function datos(cambios: Partial<DatosDeEvento> = {}): DatosDeEvento {
  return {
    titulo: 'Monitoría de Cálculo',
    lugar: '',
    notas: '',
    color: 'azul',
    todoElDia: false,
    inicio: '2026-11-17T15:00:00Z', // martes 17, 10:00
    fin: '2026-11-17T16:00:00Z',
    recordatorios: [30],
    recurrencia: null,
    compromiso: false,
    ...cambios,
  };
}

const evento = (cambios: Partial<DatosDeEvento> = {}, id = 'ev1'): EventoDeCalendario =>
  crearEvento({ id, ...datos(cambios) }, BOGOTA, AHORA);

const rango = (desde: string, hasta: string) => ({ desdeMs: ms(desde), hastaMs: ms(hasta) });

describe('fechas civiles', () => {
  it('suma días cruzando mes y año, y calcula el día de la semana (lunes = 1)', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29'); // bisiesto
    expect(diaSemana('2026-11-16')).toBe(1);
    expect(diaSemana('2026-11-15')).toBe(7);
  });

  it('meses y semanas ISO, incluido el cambio de año', () => {
    expect(sumarMeses(2026, 12, 1)).toEqual({ anio: 2027, mes: 1 });
    expect(sumarMeses(2026, 1, -1)).toEqual({ anio: 2025, mes: 12 });
    expect(inicioDeSemana('2027-01-01')).toBe('2026-12-28');
    expect(semanaIso('2026-11-15')).toBe('2026-W46');
    expect(semanaIso('2026-11-16')).toBe('2026-W47');
    expect(semanaIso('2027-01-01')).toBe('2026-W53');
    expect(semanaIso('2025-12-29')).toBe('2026-W01');
  });

  it('la cuadrícula del mes empieza en lunes y cubre semanas completas', () => {
    const dias = cuadriculaDeMes('2027-02-10');
    expect(dias[0]).toBe('2027-02-01'); // feb 2027 empieza en lunes
    expect(dias).toHaveLength(28);
    const nov = cuadriculaDeMes('2026-11-15');
    expect(nov[0]).toBe('2026-10-26');
    expect(nov.at(-1)).toBe('2026-12-06');
    expect(nov).toHaveLength(42);
  });
});

describe('CA5 · recurrencia (subconjunto de RRULE)', () => {
  const semanal = (dias: Recurrencia['dias'], fin: Recurrencia['fin'] = { tipo: 'nunca' }, intervalo = 1): Recurrencia =>
    validarRecurrencia({ frecuencia: 'semanal', intervalo, dias, fin });

  it('diaria cada 2 días con COUNT 4', () => {
    const r = validarRecurrencia({ frecuencia: 'diaria', intervalo: 2, dias: [], fin: { tipo: 'conteo', veces: 4 } });
    expect(fechasDeOcurrencia('2026-12-29', r, '2026-01-01', '2027-12-31')).toEqual(['2026-12-29', '2026-12-31', '2027-01-02', '2027-01-04']);
  });

  it('semanal lunes y miércoles hasta una fecha (UNTIL inclusivo), cruzando el año', () => {
    const r = semanal([1, 3], { tipo: 'fecha', hasta: '2027-01-06' });
    expect(fechasDeOcurrencia('2026-12-21', r, '2026-12-01', '2027-02-01')).toEqual([
      '2026-12-21',
      '2026-12-23',
      '2026-12-28',
      '2026-12-30',
      '2027-01-04',
      '2027-01-06',
    ]);
  });

  it('semanal cada 2 semanas: solo semanas alternas desde la semana de inicio', () => {
    const r = semanal([2], { tipo: 'nunca' }, 2);
    expect(fechasDeOcurrencia('2026-11-17', r, '2026-11-01', '2026-12-31')).toEqual(['2026-11-17', '2026-12-01', '2026-12-15', '2026-12-29']);
  });

  it('el rango limita el cálculo: una serie sin fin no se materializa', () => {
    const r = semanal([2]);
    const lejos = fechasDeOcurrencia('2026-11-17', r, '2036-11-01', '2036-11-30');
    expect(lejos).toHaveLength(4);
    expect(lejos.every((f) => diaSemana(f) === 2)).toBe(true);
  });

  it('COUNT cuenta desde el inicio aunque el rango empiece después', () => {
    const r = semanal([2], { tipo: 'conteo', veces: 3 });
    expect(fechasDeOcurrencia('2026-11-17', r, '2026-11-25', '2027-01-31')).toEqual(['2026-12-01']);
  });

  it('mensual el día 31: se salta los meses que no lo tienen (como RFC 5545)', () => {
    const r = validarRecurrencia({ frecuencia: 'mensual', intervalo: 1, dias: [], fin: { tipo: 'conteo', veces: 4 } });
    expect(fechasDeOcurrencia('2026-12-31', r, '2026-01-01', '2027-12-31')).toEqual(['2026-12-31', '2027-01-31', '2027-03-31', '2027-05-31']);
  });

  it('valida intervalo, días, conteo y fecha de fin', () => {
    expect(() => validarRecurrencia({ frecuencia: 'semanal', intervalo: 1, dias: [], fin: { tipo: 'nunca' } })).toThrow(RecurrenciaInvalida);
    expect(() => validarRecurrencia({ frecuencia: 'diaria', intervalo: 0, dias: [], fin: { tipo: 'nunca' } })).toThrow(RecurrenciaInvalida);
    expect(() => validarRecurrencia({ frecuencia: 'diaria', intervalo: 1, dias: [], fin: { tipo: 'conteo', veces: 0 } })).toThrow(RecurrenciaInvalida);
    expect(() => validarRecurrencia({ frecuencia: 'anual' as never, intervalo: 1, dias: [], fin: { tipo: 'nunca' } })).toThrow(RecurrenciaInvalida);
    expect(validarRecurrencia({ frecuencia: 'semanal', intervalo: 1, dias: [5, 1, 1], fin: { tipo: 'nunca' } }).dias).toEqual([1, 5]);
  });
});

describe('CA1 · evento', () => {
  it('crea un evento con hora, en UTC, y normaliza los recordatorios', () => {
    const e = evento({ titulo: '  Monitoría  de Cálculo ', recordatorios: [60, 10, 10] });
    expect(e).toMatchObject({ id: 'ev1', uid: 'ev1@ludus', titulo: 'Monitoría de Cálculo', inicio: '2026-11-17T15:00:00.000Z', recordatorios: [10, 60] });
  });

  it('fin antes del inicio, más de 14 días o título vacío no se aceptan', () => {
    expect(() => evento({ fin: '2026-11-17T14:00:00Z' })).toThrow(FinAntesDeInicio);
    expect(() => evento({ fin: '2026-12-02T16:00:00Z' })).toThrow(DuracionExcesiva);
    expect(() => evento({ titulo: ' ' })).toThrow(TituloDeEventoInvalido);
    expect(() => evento({ recordatorios: [-5] })).toThrow(RecordatorioInvalido);
    expect(() => evento({ recordatorios: [1, 2, 3, 4, 5, 6] })).toThrow(RecordatorioInvalido);
  });

  it('todo el día se guarda como fechas AAAA-MM-DD sin hora ni zona (fin inclusivo)', () => {
    const e = evento({ todoElDia: true, inicio: '2026-12-31', fin: '2027-01-01' });
    expect(e).toMatchObject({ inicio: '2026-12-31', fin: '2027-01-01', todoElDia: true });
    expect(() => evento({ todoElDia: true, inicio: '2026-12-31', fin: '2026-12-30' })).toThrow(FinAntesDeInicio);
    expect(() => evento({ todoElDia: true, inicio: '2026-12-31T05:00:00Z', fin: '2027-01-01' })).toThrow(FechaDeEventoInvalida);
  });

  it('un evento de todo el día de fin de año ocupa ambos días en hora local', () => {
    const e = evento({ todoElDia: true, inicio: '2026-12-31', fin: '2027-01-01' });
    const [o] = ocurrenciasEnRango(e, rango('2026-12-01T05:00:00Z', '2027-02-01T05:00:00Z'), BOGOTA);
    expect(o).toMatchObject({ fechaInicio: '2026-12-31', fechaFin: '2027-01-01', inicioMs: ms('2026-12-31T05:00:00Z'), finMs: ms('2027-01-02T05:00:00Z') });
  });

  it('semanal con día de inicio no elegido: la primera ocurrencia pasa al primer día elegido', () => {
    const e = evento({ recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [4], fin: { tipo: 'nunca' } } }); // martes 17 → jueves 19
    expect(e.inicio).toBe('2026-11-19T15:00:00.000Z');
    expect(e.fin).toBe('2026-11-19T16:00:00.000Z');
  });

  it('el bloque de compromiso necesita hora y entre 15 min y 8 h', () => {
    expect(() => evento({ compromiso: true, todoElDia: true, inicio: '2026-11-17', fin: '2026-11-17' })).toThrow(CompromisoInvalido);
    expect(() => evento({ compromiso: true, fin: '2026-11-17T15:10:00Z' })).toThrow(CompromisoInvalido);
    expect(evento({ compromiso: true }).compromiso).toBe(true);
  });
});

describe('CA5–CA7 · ocurrencias y excepciones', () => {
  // Clase de 7:00 a 9:00 los lunes y miércoles desde el lunes 16 nov.
  const clase = () =>
    evento({
      titulo: 'Física I',
      inicio: '2026-11-16T12:00:00Z',
      fin: '2026-11-16T14:00:00Z',
      recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1, 3], fin: { tipo: 'nunca' } },
    });
  const semana = rango('2026-11-16T05:00:00Z', '2026-11-23T05:00:00Z');

  it('se calculan solo las del rango visible, a la misma hora local', () => {
    const os = ocurrenciasEnRango(clase(), semana, BOGOTA);
    expect(os.map((o) => o.clave)).toEqual(['2026-11-16', '2026-11-18']);
    expect(os.every((o) => hora(new Date(o.inicioMs).toISOString()).minutos === 7 * 60)).toBe(true);
    expect(os[0]).toMatchObject({ recurrente: true, modificada: false, eventoId: 'ev1' });
  });

  it('borrar solo una ocurrencia la excluye; restaurarla la devuelve', () => {
    const sinMiercoles = cancelarOcurrencia(clase(), '2026-11-18', AHORA, BOGOTA);
    expect(ocurrenciasEnRango(sinMiercoles, semana, BOGOTA).map((o) => o.clave)).toEqual(['2026-11-16']);
    expect(ocurrenciasEnRango(restaurarOcurrencia(sinMiercoles, '2026-11-18', AHORA), semana, BOGOTA)).toHaveLength(2);
    expect(() => cancelarOcurrencia(clase(), '2026-11-17', AHORA, BOGOTA)).toThrow(OcurrenciaInexistente);
  });

  it('editar solo una ocurrencia (moverla al viernes) la muestra donde quedó, aunque salga o entre al rango', () => {
    const movida = editarOcurrencia(
      clase(),
      '2026-11-18',
      { titulo: 'Física I (recuperación)', lugar: 'Aula 3', notas: '', inicio: '2026-11-27T12:00:00Z', fin: '2026-11-27T14:00:00Z' },
      AHORA,
      BOGOTA,
    );
    expect(ocurrenciasEnRango(movida, semana, BOGOTA).map((o) => o.clave)).toEqual(['2026-11-16']);
    const siguiente = ocurrenciasEnRango(movida, rango('2026-11-23T05:00:00Z', '2026-11-30T05:00:00Z'), BOGOTA);
    expect(siguiente.map((o) => [o.clave, o.titulo, o.modificada])).toEqual([
      ['2026-11-23', 'Física I', false],
      ['2026-11-25', 'Física I', false],
      ['2026-11-18', 'Física I (recuperación)', true],
    ]);
  });

  it('editar la serie conserva las excepciones que siguen siendo ocurrencias y descarta las demás', () => {
    let e = cancelarOcurrencia(clase(), '2026-11-18', AHORA, BOGOTA);
    e = cancelarOcurrencia(e, '2026-11-16', AHORA, BOGOTA);
    e = editarEvento(e, { ...datos(), titulo: 'Física I', inicio: '2026-11-16T12:00:00Z', fin: '2026-11-16T14:00:00Z', recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1], fin: { tipo: 'nunca' } } }, BOGOTA, AHORA);
    expect(Object.keys(e.excepciones)).toEqual(['2026-11-16']);
  });

  it('cubre el horario de verano: la hora local se mantiene (Madrid)', () => {
    const madrid = crearZona('Europe/Madrid');
    const e = crearEvento(
      { id: 'm', ...datos({ inicio: '2027-03-22T09:00:00Z', fin: '2027-03-22T10:00:00Z', recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1], fin: { tipo: 'conteo', veces: 2 } } }) },
      madrid,
      AHORA,
    );
    const os = ocurrenciasEnRango(e, rango('2027-03-01T00:00:00Z', '2027-04-30T00:00:00Z'), madrid);
    expect(os.map((o) => new Date(o.inicioMs).toISOString())).toEqual(['2027-03-22T09:00:00.000Z', '2027-03-29T08:00:00.000Z']);
  });
});

describe('CA12 · bloque de compromiso', () => {
  const bloque = () => evento({ compromiso: true, inicio: '2026-11-15T13:00:00Z', fin: '2026-11-15T14:00:00Z' }); // hoy 8–9
  it('se marca cumplido una vez empezado y hasta 48 h después de terminar', () => {
    const e = marcarCumplida(bloque(), '2026-11-15', AHORA, BOGOTA);
    expect(e.cumplidas).toEqual(['2026-11-15']);
    expect(() => marcarCumplida(e, '2026-11-15', AHORA, BOGOTA)).toThrow(CumplimientoFueraDeTiempo);
    expect(() => marcarCumplida(bloque(), '2026-11-15', new Date('2026-11-15T12:59:00Z'), BOGOTA)).toThrow(CumplimientoFueraDeTiempo);
    expect(() => marcarCumplida(bloque(), '2026-11-15', new Date('2026-11-17T14:01:00Z'), BOGOTA)).toThrow(CumplimientoFueraDeTiempo);
    expect(() => marcarCumplida(evento(), '2026-11-17', new Date('2026-11-17T15:30:00Z'), BOGOTA)).toThrow(CompromisoInvalido);
  });
});

describe('CA2 · elementos de otros módulos', () => {
  it('un vencimiento puntual de Universidad se vuelve elemento externo de solo lectura', () => {
    const x = elementoExterno('universidad', { id: 'e1', titulo: 'Taller 3', inicio: '2026-11-21T04:59:00.000Z', tipo: 'vencimiento', estado: 'hecho', color: 'verde' }, BOGOTA);
    expect(x).toMatchObject({ fuente: 'externo', origen: 'universidad', clave: 'universidad:e1', fechaInicio: '2026-11-20', puntual: true, hecho: true, color: 'verde' });
  });

  it('datos mal formados se rechazan sin romper nada', () => {
    expect(() => elementoExterno('x', { id: 'a', titulo: 'b', inicio: 'mañana', tipo: 'evento', estado: 'pendiente' } as never, BOGOTA)).toThrow(ElementoDeAgendaInvalido);
    expect(() => elementoExterno('x', null as never, BOGOTA)).toThrow(ElementoDeAgendaInvalido);
  });
});

describe('CA3, CA4, CA9 · distribución en vistas', () => {
  it('agrupa por día local: un evento a las 23:30 de Bogotá cae ese día (no el siguiente en UTC)', () => {
    const e = evento({ inicio: '2026-11-15T04:30:00Z', fin: '2026-11-15T05:00:00Z' });
    const os = ocurrenciasEnRango(e, rango('2026-11-14T05:00:00Z', '2026-11-16T05:00:00Z'), BOGOTA);
    const dias = agruparPorDia(os, '2026-11-14', 2, BOGOTA);
    expect(dias[0]!.conHora.map((o) => o.titulo)).toEqual(['Monitoría de Cálculo']);
    expect(dias[1]!.conHora).toEqual([]);
  });

  it('un evento de todo el día de varios días aparece en cada día', () => {
    const e = evento({ todoElDia: true, inicio: '2026-11-30', fin: '2026-12-02' });
    const os = ocurrenciasEnRango(e, rango('2026-11-29T05:00:00Z', '2026-12-04T05:00:00Z'), BOGOTA);
    expect(agruparPorDia(os, '2026-11-29', 5, BOGOTA).map((d) => d.todoElDia.length)).toEqual([0, 1, 1, 1, 0]);
  });

  it('eventos que se solapan se reparten en columnas', () => {
    const a = evento({ inicio: '2026-11-17T15:00:00Z', fin: '2026-11-17T16:00:00Z' }, 'a');
    const b = evento({ inicio: '2026-11-17T15:30:00Z', fin: '2026-11-17T16:30:00Z' }, 'b');
    const c = evento({ inicio: '2026-11-17T17:00:00Z', fin: '2026-11-17T18:00:00Z' }, 'c');
    const r = rango('2026-11-17T05:00:00Z', '2026-11-18T05:00:00Z');
    const os = [a, b, c].flatMap((e) => ocurrenciasEnRango(e, r, BOGOTA));
    const pos = columnasDelDia(os, '2026-11-17', BOGOTA);
    expect(pos.map((p) => [p.elemento.eventoId, p.columna, p.columnas])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 1],
    ]);
    expect(pos[0]).toMatchObject({ desdeMinuto: 600, hastaMinuto: 660 });
  });
});

describe('CA8 · recordatorios', () => {
  const e = () => evento({ recordatorios: [10, 60] }); // martes 17, 10:00
  const os = () => ocurrenciasEnRango(e(), rango('2026-11-15T05:00:00Z', '2026-11-25T05:00:00Z'), BOGOTA);

  it('avisos que vencen en un intervalo (para notificar con la app abierta)', () => {
    const avisos = avisosEntre(os(), ms('2026-11-17T13:30:00Z'), ms('2026-11-17T14:45:00Z'));
    expect(avisos.map((a) => [a.minutos, new Date(a.momentoMs).toISOString()])).toEqual([[60, '2026-11-17T14:00:00.000Z']]);
    expect(avisos[0]!.clave).toBe('ev1|2026-11-17|60');
  });

  it('al abrir: pendientes los vencidos mientras el evento no termina y no se descartaron', () => {
    expect(avisosPendientes(os(), ms('2026-11-17T14:45:00Z'), new Set()).map((a) => a.minutos)).toEqual([60]);
    expect(avisosPendientes(os(), ms('2026-11-17T15:55:00Z'), new Set()).map((a) => a.minutos)).toEqual([60, 10]);
    expect(avisosPendientes(os(), ms('2026-11-17T15:55:00Z'), new Set(['ev1|2026-11-17|60']))).toHaveLength(1);
    expect(avisosPendientes(os(), ms('2026-11-17T16:01:00Z'), new Set())).toEqual([]);
  });
});
