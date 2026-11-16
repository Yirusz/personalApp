import { describe, expect, it } from 'vitest';
import { normalizarFicha } from './fichas';

const valida = { id: 'm1', titulo: '  Cálculo   II ', color: 'verde', duracionMin: 120, repeticion: { tipo: 'semanal', semanas: 16 }, vinculo: { tipo: 'universidad.materia', id: 'm1' } };

describe('Fichas (lenguaje publicado, ADR-0015)', () => {
  it('normaliza una ficha válida', () => {
    expect(normalizarFicha(valida)).toEqual({ ...valida, titulo: 'Cálculo II' });
    expect(normalizarFicha({ ...valida, color: '#ABCDEF', repeticion: { tipo: 'unica' }, vinculo: undefined })).toMatchObject({ color: '#abcdef', repeticion: { tipo: 'unica' } });
  });
  it.each([
    ['sin id', { ...valida, id: '' }],
    ['título vacío', { ...valida, titulo: '  ' }],
    ['color raro', { ...valida, color: 'fucsia' }],
    ['duración corta', { ...valida, duracionMin: 5 }],
    ['duración no entera', { ...valida, duracionMin: 30.5 }],
    ['semanas de más', { ...valida, repeticion: { tipo: 'semanal', semanas: 53 } }],
    ['vínculo mal formado', { ...valida, vinculo: { tipo: 'materia', id: 'x' } }],
    ['nada', null],
  ])('rechaza: %s', (_, f) => expect(() => normalizarFicha(f)).toThrow());
});
