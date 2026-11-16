import { describe, expect, it } from 'vitest';
import { crearEntorno } from '../../pruebas/entorno';
import type { Migracion } from '../contrato';
import { ErrorDeAlmacen, type EsquemaDeModulo } from './almacen-indexeddb';

const v1: Migracion = { version: 1, descripcion: 'notas', aplicar: (c) => c.crearAlmacen('notas') };
const v2: Migracion = { version: 2, descripcion: 'índice', aplicar: (c) => c.crearIndice('notas', 'por_titulo', 'titulo') };
const v3: Migracion = {
  version: 3,
  descripcion: 'titulo en mayúsculas',
  aplicar: (c) => c.transformar('notas', (n) => ({ ...(n as object), titulo: String((n as { titulo: string }).titulo).toUpperCase() })),
};

const notas = (migraciones: Migracion[]): EsquemaDeModulo => ({
  id: 'notas',
  migraciones,
  eventos: { 'notas.NotaCreada': { version: 1, descripcion: '' } },
});
const otro: EsquemaDeModulo = { id: 'otro', migraciones: [{ version: 1, descripcion: '', aplicar: (c) => c.crearAlmacen('cosas') }] };

describe('almacén IndexedDB', () => {
  it('aplica las migraciones de cada módulo y registra su versión', async () => {
    const e = await crearEntorno([notas([v1, v2]), otro]);
    expect(await e.almacen.versionesDeEsquema()).toEqual({ nucleo: 1, notas: 2, otro: 1 });
    expect(e.almacen.nombresDeAlmacenes()).toEqual(expect.arrayContaining(['notas_notas', 'otro_cosas', 'nucleo_eventos']));
  });

  it('al agregar una migración solo aplica la nueva y conserva los datos', async () => {
    const e = await crearEntorno([notas([v1, v2])]);
    await e.almacen.paraModulo('notas').escribir(['notas'], (tx) => tx.poner('notas', { id: 'n1', titulo: 'hola' }));
    const e2 = await e.reabrir([notas([v1, v2, v3])]);
    expect(await e2.almacen.versionesDeEsquema()).toMatchObject({ notas: 3 });
    const nota = await e2.almacen.paraModulo('notas').leer(['notas'], (tx) => tx.obtener<{ titulo: string }>('notas', 'n1'));
    expect(nota?.titulo).toBe('HOLA');
  });

  it('agregar un módulo nuevo no toca los existentes', async () => {
    const e = await crearEntorno([notas([v1])]);
    await e.almacen.paraModulo('notas').escribir(['notas'], (tx) => tx.poner('notas', { id: 'n1', titulo: 'x' }));
    const e2 = await e.reabrir([notas([v1]), otro]);
    expect(await e2.almacen.versionesDeEsquema()).toEqual({ nucleo: 1, notas: 1, otro: 1 });
    expect(await e2.almacen.contarTodo()).toMatchObject({ notas_notas: 1 });
  });

  it('no abre datos de una versión más nueva de la app', async () => {
    const e = await crearEntorno([notas([v1, v2])]);
    e.almacen.cerrar();
    await expect(crearEntorno([notas([v1])], { fabrica: e.fabrica })).rejects.toThrow(/más nueva/);
  });

  it('un módulo no puede tocar almacenes de otro', async () => {
    const e = await crearEntorno([notas([v1]), otro]);
    await expect(e.almacen.paraModulo('notas').escribir(['cosas'], async () => undefined)).rejects.toThrow(ErrorDeAlmacen);
    await expect(
      e.almacen.paraModulo('notas').escribir(['notas'], (tx) => tx.poner('cosas', { id: 1 })),
    ).rejects.toThrow(/alcance/);
  });

  it('un módulo solo publica eventos que declaró', async () => {
    const e = await crearEntorno([notas([v1])]);
    await expect(
      e.almacen.paraModulo('notas').escribir(['notas'], async (tx) => {
        tx.publicar('notas.NoDeclarado', {});
      }),
    ).rejects.toThrow(/no declaró/);
  });

  it('ocurridoEn explícito (ADR-0016): cuándo pasó de verdad; nunca en el futuro', async () => {
    const e = await crearEntorno([notas([v1])]); // reloj: 2026-11-14T15:00:00Z
    const almacen = e.almacen.paraModulo('notas');
    const ev = await almacen.escribir(['notas'], async (tx) => tx.publicar('notas.NotaCreada', {}, { ocurridoEn: '2026-11-14T04:55:00-05:00' }));
    expect(ev.ocurridoEn).toBe('2026-11-14T09:55:00.000Z');
    const normal = await almacen.escribir(['notas'], async (tx) => tx.publicar('notas.NotaCreada', {}));
    expect(normal.ocurridoEn).toBe('2026-11-14T15:00:00.000Z');
    // El orden de entrega es el de publicación (id), no el de ocurridoEn.
    expect(ev.id < normal.id).toBe(true);
    await expect(almacen.escribir(['notas'], async (tx) => tx.publicar('notas.NotaCreada', {}, { ocurridoEn: '2026-11-14T15:00:01Z' }))).rejects.toThrow(/futuro/);
    await expect(almacen.escribir(['notas'], async (tx) => tx.publicar('notas.NotaCreada', {}, { ocurridoEn: 'ayer' }))).rejects.toThrow(/inválido/);
  });

  it('si la función falla, se deshacen los cambios Y los eventos (todo o nada)', async () => {
    const e = await crearEntorno([notas([v1])]);
    const almacen = e.almacen.paraModulo('notas');
    await expect(
      almacen.escribir(['notas'], async (tx) => {
        await tx.poner('notas', { id: 'n1', titulo: 'x' });
        tx.publicar('notas.NotaCreada', { notaId: 'n1' });
        throw new Error('regla de negocio violada');
      }),
    ).rejects.toThrow('regla de negocio violada');
    expect(await e.almacen.contarTodo()).toMatchObject({ notas_notas: 0, nucleo_eventos: 0 });
  });

  it('guarda el evento con id UUIDv7, módulo, versión e instante del reloj', async () => {
    const e = await crearEntorno([notas([v1])]);
    const evento = await e.almacen.paraModulo('notas').escribir(['notas'], async (tx) => {
      await tx.poner('notas', { id: 'n1', titulo: 'x' });
      return tx.publicar('notas.NotaCreada', { notaId: 'n1' });
    });
    expect(evento).toMatchObject({ tipo: 'notas.NotaCreada', modulo: 'notas', version: 1, ocurridoEn: '2026-11-14T15:00:00.000Z' });
    expect(await e.almacen.ultimoEventoId()).toBe(evento.id);
  });

  it('avisa a quien escucha cambios solo de sus almacenes', async () => {
    const e = await crearEntorno([notas([v1]), otro]);
    let avisosNotas = 0;
    let avisosOtro = 0;
    e.almacen.paraModulo('notas').alCambiar(['notas'], () => avisosNotas++);
    e.almacen.paraModulo('otro').alCambiar(['cosas'], () => avisosOtro++);
    await e.almacen.paraModulo('notas').escribir(['notas'], (tx) => tx.poner('notas', { id: 'n1', titulo: 'x' }));
    expect([avisosNotas, avisosOtro]).toEqual([1, 0]);
  });

  it('lista en orden inverso con límite y por rango de índice', async () => {
    const e = await crearEntorno([notas([v1, v2])]);
    const a = e.almacen.paraModulo('notas');
    await a.escribir(['notas'], async (tx) => {
      for (const [id, titulo] of [['1', 'b'], ['2', 'a'], ['3', 'c']]) await tx.poner('notas', { id, titulo });
    });
    const inversos = await a.leer(['notas'], (tx) => tx.listar<{ id: string }>('notas', { inverso: true, limite: 2 }));
    expect(inversos.map((n) => n.id)).toEqual(['3', '2']);
    const porTitulo = await a.leer(['notas'], (tx) => tx.listar<{ id: string }>('notas', { indice: 'por_titulo', desde: 'b' }));
    expect(porTitulo.map((n) => n.id)).toEqual(['1', '3']);
  });
});
