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

  it('convierte un instante UTC al valor de <input type="datetime-local"> en hora de Bogotá', () => {
    expect(f.entradaLocal('2026-11-21T04:59:00Z')).toBe('2026-11-20T23:59');
    expect(f.entradaLocal('2026-01-01T05:00:00Z')).toBe('2026-01-01T00:00');
  });

  it('interpreta la hora escrita como hora de Bogotá, sin importar la zona del dispositivo', () => {
    expect(f.desdeEntradaLocal('2026-11-20T23:59')).toBe('2026-11-21T04:59:00.000Z');
    expect(f.desdeEntradaLocal('2026-11-20T23:59:30')).toBe('2026-11-21T04:59:30.000Z');
    // Ida y vuelta.
    expect(f.entradaLocal(f.desdeEntradaLocal('2026-03-08T02:30')!)).toBe('2026-03-08T02:30');
  });

  it('rechaza valores de fecha inválidos o vacíos', () => {
    for (const malo of ['', 'mañana', '2026-02-30T10:00', '2026-11-20', '2026-11-20T25:00']) {
      expect(f.desdeEntradaLocal(malo), malo).toBeNull();
    }
  });

  it('respeta zonas con horario de verano (prueba de la conversión genérica)', () => {
    const madrid = crearFormatos('Europe/Madrid');
    expect(madrid.desdeEntradaLocal('2026-07-01T12:00')).toBe('2026-07-01T10:00:00.000Z'); // UTC+2
    expect(madrid.desdeEntradaLocal('2026-12-01T12:00')).toBe('2026-12-01T11:00:00.000Z'); // UTC+1
  });

  it('describe tiempos relativos en español', () => {
    const ahora = '2026-11-14T15:00:00Z';
    expect(f.relativo('2026-11-14T18:00:00Z', ahora)).toBe('dentro de 3 horas');
    expect(f.relativo('2026-11-16T15:00:00Z', ahora)).toBe('pasado mañana');
    expect(f.relativo('2026-11-14T14:30:00Z', ahora)).toBe('hace 30 minutos');
  });
});
