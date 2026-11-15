import { describe, expect, it } from 'vitest';
import { crearFormatos, crearTraductor } from './traductor';
import nucleo from './es-CO.json';

describe('traductor', () => {
  const t = crearTraductor({
    'a.hola': 'Hola, {nombre}',
    'a.monto': 'Total: {n}',
    'a.tareas.uno': '{n} tarea',
    'a.tareas.otro': '{n} tareas',
  });

  it('interpola parámetros y formatea números en es-CO', () => {
    expect(t('a.hola', { nombre: 'Gabriel' })).toBe('Hola, Gabriel');
    expect(t('a.monto', { n: 25000 })).toBe('Total: 25.000');
  });

  it('elige la forma plural', () => {
    expect(t('a.tareas', { n: 1 })).toBe('1 tarea');
    expect(t('a.tareas', { n: 3 })).toBe('3 tareas');
  });

  it('muestra la clave faltante de forma visible y avisa', () => {
    const faltantes: string[] = [];
    const t2 = crearTraductor({}, (c) => faltantes.push(c));
    expect(t2('x.no')).toBe('⟦x.no⟧');
    expect(faltantes).toEqual(['x.no']);
  });

  it('los textos del núcleo no tienen valores vacíos', () => {
    for (const [clave, valor] of Object.entries(nucleo)) expect(valor.trim(), clave).not.toBe('');
  });
});

describe('formatos', () => {
  const f = crearFormatos('America/Bogota');

  it('calcula el día local de Bogotá (UTC−5), no el de UTC', () => {
    // 04:30 UTC del 15 = 23:30 del 14 en Bogotá.
    expect(f.diaLocal('2026-11-15T04:30:00Z')).toBe('2026-11-14');
    expect(f.diaLocal('2026-11-15T05:00:00Z')).toBe('2026-11-15');
  });

  it('formatea números con separadores colombianos', () => {
    expect(f.numero(1234.5)).toBe('1.234,5');
  });
});
