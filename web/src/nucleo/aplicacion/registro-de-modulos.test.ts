import { describe, expect, it } from 'vitest';
import { MODULOS } from '../../modulos';
import { RUTAS_DEL_NUCLEO } from '../../ui/rutas';
import type { DefinicionDeModulo } from '../contrato';
import { ModulosInvalidos, RegistroDeModulos } from './registro-de-modulos';

const base = (cambios: Partial<DefinicionDeModulo> = {}): DefinicionDeModulo => ({
  id: 'tareas',
  version: '1.0.0',
  nombre: 'tareas.nombre',
  textos: { 'tareas.nombre': 'Tareas', 'tareas.titulo': 'Tareas' },
  rutas: [{ patron: '/tareas', titulo: 'tareas.titulo', vista: () => Promise.reject(new Error('no se usa')) }],
  migraciones: [{ version: 1, descripcion: 'x', aplicar: () => undefined }],
  eventos: { 'tareas.TareaCreada': { version: 1, descripcion: 'x' } },
  ...cambios,
});

const problemas = (defs: DefinicionDeModulo[]) => {
  try {
    new RegistroDeModulos(defs, RUTAS_DEL_NUCLEO);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(ModulosInvalidos);
    return (e as ModulosInvalidos).problemas;
  }
};

describe('registro de módulos', () => {
  it('acepta los módulos reales del repositorio', () => {
    expect(problemas([...MODULOS])).toEqual([]);
    expect(MODULOS.map((m) => m.id)).toEqual(expect.arrayContaining(['ejemplo', 'rpg']));
  });

  it('acepta un módulo bien formado', () => {
    expect(problemas([base()])).toEqual([]);
  });

  it('rechaza ids duplicados, reservados o con mayúsculas', () => {
    expect(problemas([base(), base()])).toEqual(expect.arrayContaining([expect.stringContaining('id duplicado')]));
    expect(problemas([base({ id: 'nucleo' })])).toEqual(expect.arrayContaining([expect.stringContaining('reservado')]));
    expect(problemas([base({ id: 'Tareas' })]).length).toBeGreaterThan(0);
  });

  it('exige que eventos, textos y rutas lleven el prefijo del módulo', () => {
    const p = problemas([
      base({
        eventos: { 'otro.Algo': { version: 1, descripcion: '' } },
        textos: { 'tareas.nombre': 'T', 'tareas.titulo': 'T', 'ajeno.x': 'x' },
        rutas: [{ patron: '/ajena', titulo: 'tareas.titulo', vista: () => Promise.reject(new Error()) }],
      }),
    ]);
    expect(p).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"otro.Algo" debe empezar por "tareas."'),
        expect.stringContaining('"ajeno.x"'),
        expect.stringContaining('"/ajena"'),
      ]),
    );
  });

  it('rechaza migraciones no consecutivas', () => {
    const p = problemas([base({ migraciones: [{ version: 2, descripcion: '', aplicar: () => undefined }] })]);
    expect(p).toEqual(expect.arrayContaining([expect.stringContaining('migración')]));
  });

  it('ordena la navegación por "orden"', () => {
    const r = new RegistroDeModulos([
      base({ navegacion: { etiqueta: 'tareas.nombre', icono: '', orden: 20, ruta: '/tareas' } }),
      base({
        id: 'notas',
        nombre: 'notas.n',
        textos: { 'notas.n': 'Notas' },
        rutas: [{ patron: '/notas', titulo: 'notas.n', vista: () => Promise.reject(new Error()) }],
        eventos: {},
        navegacion: { etiqueta: 'notas.n', icono: '', orden: 10, ruta: '/notas' },
      }),
    ]);
    expect(r.navegacion().map((n) => n.moduloId)).toEqual(['notas', 'tareas']);
  });
});
