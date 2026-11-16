import { describe, expect, it } from 'vitest';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import { crearEvento } from './evento';
import { ocurrenciasEnRango } from './expansion';
import { claveDeFicha, crearFichaPropia, editarFichaPropia, eventoDesdeFicha, horaDeHueco } from './ficha';

const BOGOTA = crearZona('America/Bogota');
const AHORA = new Date('2026-11-15T20:00:00Z');
const MATERIA = { id: 'm1', titulo: 'Cálculo II', color: 'verde' as const, duracionMin: 120, repeticion: { tipo: 'semanal' as const, semanas: 16 }, vinculo: { tipo: 'universidad.materia', id: 'm1' } };

describe('Ficha → evento (H8)', () => {
  it('una ficha semanal crea una serie de N semanas en ese día y hora, vinculada y marcada con su ficha', () => {
    const lunes7 = BOGOTA.aUtc('2026-11-16', 7 * 60);
    const d = eventoDesdeFicha(MATERIA, claveDeFicha('universidad', 'm1'), lunes7, BOGOTA);
    expect(d).toMatchObject({
      titulo: 'Cálculo II',
      color: 'verde',
      inicio: '2026-11-16T12:00:00.000Z',
      fin: '2026-11-16T14:00:00.000Z',
      recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1], fin: { tipo: 'conteo', veces: 16 } },
      vinculo: { tipo: 'universidad.materia', id: 'm1' },
      ficha: 'universidad:m1',
    });
    const e = crearEvento({ ...d, id: 'e1' }, BOGOTA, AHORA);
    // Cruza el cambio de año: 16 lunes desde el 16 de noviembre llegan hasta el 1 de marzo.
    const todas = ocurrenciasEnRango(e, { desdeMs: Date.parse('2026-11-01T00:00:00Z'), hastaMs: Date.parse('2027-06-01T00:00:00Z') }, BOGOTA);
    expect(todas).toHaveLength(16);
    expect(todas.at(-1)!.clave).toBe('2027-03-01');
  });

  it('una ficha única crea un evento sin repetición', () => {
    const d = eventoDesdeFicha({ ...MATERIA, repeticion: { tipo: 'unica' }, duracionMin: 45 }, 'calendario:f1', BOGOTA.aUtc('2026-12-31', 23 * 60 + 30), BOGOTA);
    expect(d.recurrencia).toBeNull();
    expect(d.fin).toBe('2027-01-01T05:15:00.000Z'); // 31 dic 23:30 + 45 min = 1 ene 00:15 local
  });

  it('horaDeHueco redondea a la media hora hacia abajo', () => {
    expect(horaDeHueco(7 * 60 + 44)).toBe(7 * 60 + 30);
    expect(horaDeHueco(7 * 60 + 29)).toBe(7 * 60);
    expect(horaDeHueco(1439)).toBe(23 * 60 + 30);
  });
});

describe('Fichas propias', () => {
  const datos = { titulo: ' Gimnasio ', color: '#FF7043', duracionMin: 60, repeticion: { tipo: 'semanal' as const, semanas: 8 } };
  it('se crean y editan validando título, color, duración y repetición', () => {
    const f = crearFichaPropia({ ...datos, id: 'f1' }, AHORA);
    expect(f).toMatchObject({ id: 'f1', titulo: 'Gimnasio', color: '#ff7043', duracionMin: 60, creadaEn: AHORA.toISOString() });
    const g = editarFichaPropia(f, { ...datos, titulo: 'Gym', repeticion: { tipo: 'unica' } }, new Date('2026-11-16T00:00:00Z'));
    expect(g).toMatchObject({ titulo: 'Gym', repeticion: { tipo: 'unica' }, creadaEn: AHORA.toISOString(), actualizadaEn: '2026-11-16T00:00:00.000Z' });
  });
  it.each([
    ['título vacío', { titulo: ' ' }, 'calendario.error.titulo.vacio'],
    ['color inválido', { color: 'fucsia' }, 'calendario.error.color'],
    ['duración', { duracionMin: 10 }, 'calendario.error.ficha.duracion'],
    ['semanas', { repeticion: { tipo: 'semanal' as const, semanas: 0 } }, 'calendario.error.ficha.semanas'],
  ])('rechaza %s con mensaje de negocio', (_, cambio, clave) => {
    expect(() => crearFichaPropia({ ...datos, ...cambio, id: 'f1' } as never, AHORA)).toThrow(expect.objectContaining({ clave }));
  });
});
