import { describe, expect, it, vi } from 'vitest';
import { definirModulo, type ContextoDeModulo } from '../contrato';
import { crearIntegraciones } from './integraciones';

const fuente = (id: string, falla = false) => ({
  id,
  nombre: `${id}.nombre`,
  elementos: async () => (falla ? Promise.reject(new Error('roto')) : []),
  alCambiar: () => () => undefined,
});

const modulo = (id: string, tipos: string[], falla = false) =>
  definirModulo({
    id,
    version: '1.0.0',
    nombre: `${id}.nombre`,
    textos: { [`${id}.nombre`]: id },
    rutas: [],
    migraciones: [],
    eventos: {},
    proveedores: () => ({
      fuentesDeCalendario: [fuente(`${id}.vencimientos`)],
      referencias: {
        tipos,
        buscar: async (c) => (falla ? Promise.reject(new Error('roto')) : tipos.filter((t) => !c.tipo || t === c.tipo).map((tipo) => ({ tipo, id: `${tipo}-1`, titulo: tipo, activa: true }))),
      },
      fichas: {
        nombre: `${id}.fichas`,
        fichas: async () =>
          falla
            ? Promise.reject(new Error('roto'))
            : [
                { id: 'f1', titulo: 'Clase', color: 'azul', duracionMin: 120, repeticion: { tipo: 'semanal', semanas: 16 } },
                { id: 'mala', titulo: '', color: 'azul', duracionMin: 120, repeticion: { tipo: 'unica' } },
              ],
        alCambiar: () => () => undefined,
      },
    }),
  });

describe('integraciones por consulta (ADR-0013)', () => {
  const diagnostico = { registrar: vi.fn() };
  const contextoDe = vi.fn((id: string) => ({ moduloId: id, diagnostico }) as unknown as ContextoDeModulo);

  it('reúne fuentes y referencias; un proveedor que falla no tumba a los demás', async () => {
    const i = crearIntegraciones([modulo('a', ['a.materia']), modulo('b', ['b.cosa'], true)], contextoDe);
    expect(i.fuentesDeCalendario().map((f) => [f.modulo, f.fuente.id])).toEqual([
      ['a', 'a.vencimientos'],
      ['b', 'b.vencimientos'],
    ]);
    expect(i.tiposDeReferencia()).toEqual(['a.materia', 'b.cosa']);
    const r = await i.buscarReferencias({});
    expect(r.referencias.map((x) => x.id)).toEqual(['a.materia-1']);
    expect(r.fallos.map((f) => f.modulo)).toEqual(['b']);
    expect((await i.buscarReferencias({ tipo: 'a.materia' })).fallos).toEqual([]);
  });

  it('fichas (ADR-0015): agrupadas por módulo, validadas; las inválidas y los módulos caídos se informan', async () => {
    const i = crearIntegraciones([modulo('a', []), modulo('b', [], true)], contextoDe);
    const r = await i.fichas();
    expect(r.grupos).toEqual([{ modulo: 'a', nombre: 'a.fichas', fichas: [{ id: 'f1', titulo: 'Clase', color: 'azul', duracionMin: 120, repeticion: { tipo: 'semanal', semanas: 16 } }] }]);
    expect(r.fallos).toMatchObject([{ modulo: 'a', omitidas: 1 }, { modulo: 'b', nombre: 'b.fichas', omitidas: 0 }]);
    expect(typeof i.alCambiarFichas(() => undefined)).toBe('function');
  });

  it('crea los proveedores una sola vez, con el contexto del módulo que los ofrece', () => {
    contextoDe.mockClear();
    const i = crearIntegraciones([modulo('a', [])], contextoDe);
    i.fuentesDeCalendario();
    i.fuentesDeCalendario();
    expect(contextoDe.mock.calls).toEqual([['a']]);
  });
});
