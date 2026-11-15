import { describe, expect, it } from 'vitest';
import { crearEntorno } from '../../pruebas/entorno';
import type { EsquemaDeModulo } from '../infraestructura/almacen-indexeddb';
import { RespaldoInvalido, crearRespaldo, leerRespaldo, nombreDeArchivo, restaurarRespaldo } from './respaldo';

const notas: EsquemaDeModulo = {
  id: 'notas',
  migraciones: [{ version: 1, descripcion: '', aplicar: (c) => c.crearAlmacen('notas') }],
  eventos: { 'notas.NotaCreada': { version: 1, descripcion: '' } },
};

async function conDatos() {
  const e = await crearEntorno([notas]);
  await e.almacen.paraModulo('notas').escribir(['notas'], async (tx) => {
    await tx.poner('notas', { id: 'n1', titulo: 'Cálculo II', etiquetas: ['u'] });
    tx.publicar('notas.NotaCreada', { notaId: 'n1' });
  });
  return e;
}

describe('respaldo', () => {
  it('exportar e importar en otro dispositivo deja los mismos datos', async () => {
    const origen = await conDatos();
    const texto = JSON.stringify(await crearRespaldo(origen.almacen, origen.reloj, '0.1.0'));

    const destino = await crearEntorno([notas]);
    const respaldo = leerRespaldo(texto, await destino.almacen.versionesDeEsquema(), destino.almacen.nombresDeAlmacenes());
    await restaurarRespaldo(destino.almacen, respaldo);

    expect(await destino.almacen.exportarTodo()).toEqual(await origen.almacen.exportarTodo());
  });

  it('importar reemplaza (no mezcla) los datos existentes', async () => {
    const origen = await conDatos();
    const respaldo = await crearRespaldo(origen.almacen, origen.reloj, '0.1.0');
    const destino = await crearEntorno([notas]);
    await destino.almacen.paraModulo('notas').escribir(['notas'], (tx) => tx.poner('notas', { id: 'local', titulo: 'x' }));
    await restaurarRespaldo(destino.almacen, respaldo);
    const ids = await destino.almacen.paraModulo('notas').leer(['notas'], (tx) => tx.listar<{ id: string }>('notas'));
    expect(ids.map((n) => n.id)).toEqual(['n1']);
  });

  it('tras importar, los ids nuevos siguen siendo posteriores a los importados', async () => {
    const origen = await conDatos();
    const respaldo = await crearRespaldo(origen.almacen, origen.reloj, '0.1.0');
    const destino = await crearEntorno([notas]);
    destino.reloj.fijar('2020-01-01T00:00:00Z'); // reloj del otro dispositivo atrasado
    await restaurarRespaldo(destino.almacen, respaldo);
    const ultimoImportado = (await destino.almacen.ultimoEventoId())!;
    expect(destino.ids.siguiente() > ultimoImportado).toBe(true);
  });

  it('rechaza archivos que no son respaldos o vienen de otro esquema, sin tocar los datos', async () => {
    const e = await conDatos();
    const actuales = await e.almacen.versionesDeEsquema();
    const almacenes = e.almacen.nombresDeAlmacenes();
    expect(() => leerRespaldo('{no json', actuales, almacenes)).toThrow(RespaldoInvalido);
    expect(() => leerRespaldo('{"formato":"otro"}', actuales, almacenes)).toThrow(/no es un respaldo/);

    const respaldo = await crearRespaldo(e.almacen, e.reloj, '0.1.0');
    const otroEsquema = { ...respaldo, esquemas: { ...respaldo.esquemas, notas: 2 } };
    expect(() => leerRespaldo(JSON.stringify(otroEsquema), actuales, almacenes)).toThrow(/otra versión del esquema/);

    const almacenAjeno = { ...respaldo, almacenes: { ...respaldo.almacenes, intruso_x: [] } };
    expect(() => leerRespaldo(JSON.stringify(almacenAjeno), actuales, almacenes)).toThrow(/desconocido/);
    expect(await e.almacen.contarTodo()).toMatchObject({ notas_notas: 1 });
  });

  it('una importación que falla a mitad no deja datos a medias', async () => {
    const e = await conDatos();
    const respaldo = await crearRespaldo(e.almacen, e.reloj, '0.1.0');
    // Registro sin clave primaria: IndexedDB lo rechaza en medio de la importación.
    const danado = { ...respaldo.almacenes, notas_notas: [{ id: 'ok', titulo: 'a' }, { titulo: 'sin id' }] };
    await expect(e.almacen.reemplazarTodo(danado)).rejects.toBeTruthy();
    const ids = await e.almacen.paraModulo('notas').leer(['notas'], (tx) => tx.listar<{ id: string }>('notas'));
    expect(ids.map((n) => n.id)).toEqual(['n1']);
  });

  it('el nombre de archivo es válido en Windows (sin ":")', () => {
    expect(nombreDeArchivo({ exportadoEn: '2026-11-14T15:00:00.000Z' })).toBe('ludus-respaldo-2026-11-14T15-00-00.json');
  });
});
