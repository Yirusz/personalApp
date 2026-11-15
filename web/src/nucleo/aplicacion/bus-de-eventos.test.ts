import { describe, expect, it } from 'vitest';
import { crearEntorno, type Entorno } from '../../pruebas/entorno';
import type { Suscripcion } from '../contrato';
import type { EventoDeDominio } from '../dominio/evento';
import type { EsquemaDeModulo } from '../infraestructura/almacen-indexeddb';

const productor: EsquemaDeModulo = {
  id: 'tareas',
  migraciones: [{ version: 1, descripcion: '', aplicar: (c) => c.crearAlmacen('tareas') }],
  eventos: { 'tareas.TareaCompletada': { version: 1, descripcion: '' }, 'tareas.TareaCreada': { version: 1, descripcion: '' } },
};
const consumidor: EsquemaDeModulo = {
  id: 'contador',
  migraciones: [{ version: 1, descripcion: '', aplicar: (c) => c.crearAlmacen('vistos') }],
  eventos: { 'contador.HitoAlcanzado': { version: 1, descripcion: '' } },
};

async function completar(e: Entorno, id: string) {
  await e.almacen.paraModulo('tareas').escribir(['tareas'], async (tx) => {
    await tx.poner('tareas', { id });
    tx.publicar('tareas.TareaCompletada', { tareaId: id });
  });
}

/** Suscripción que guarda cada evento recibido en su almacén. */
function registrarVistos(tipos: Suscripcion['tipos'] = ['tareas.TareaCompletada'], extra?: Partial<Suscripcion>): Suscripcion {
  return {
    id: 'contador.vistos',
    tipos,
    almacenes: ['vistos'],
    async manejar(evento, tx) {
      await tx.poner('vistos', { id: evento.id, tipo: evento.tipo });
    },
    ...extra,
  };
}

const vistos = (e: Entorno) =>
  e.almacen.paraModulo('contador').leer(['vistos'], (tx) => tx.listar<{ id: string; tipo: string }>('vistos'));

describe('bus de eventos', () => {
  it('entrega a la suscripción los eventos de su tipo, en orden', async () => {
    const e = await crearEntorno([productor, consumidor]);
    e.bus.registrar('contador', registrarVistos());
    await e.bus.iniciar();
    await completar(e, 'a');
    await completar(e, 'b');
    await e.almacen.paraModulo('tareas').escribir(['tareas'], async (tx) => {
      tx.publicar('tareas.TareaCreada', {});
    });
    await e.bus.procesarPendientes();
    const recibidos = await vistos(e);
    expect(recibidos.map((v) => v.tipo)).toEqual(['tareas.TareaCompletada', 'tareas.TareaCompletada']);
  });

  it('retoma tras reiniciar la app y no entrega dos veces (exactamente una vez)', async () => {
    const e = await crearEntorno([productor, consumidor]);
    // Primera sesión: se publica pero la app "se cierra" antes de entregar (sin suscripciones).
    await completar(e, 'a');
    const e2 = await e.reabrir();
    e2.bus.registrar('contador', registrarVistos());
    await e2.bus.iniciar();
    await e2.bus.procesarPendientes();
    expect(await vistos(e2)).toHaveLength(1);
    // Tercera sesión: nada nuevo que entregar.
    const e3 = await e2.reabrir();
    e3.bus.registrar('contador', registrarVistos());
    await e3.bus.iniciar();
    expect(await vistos(e3)).toHaveLength(1);
  });

  it('si la suscripción falla, deshace lo suyo, queda en pausa y no bloquea a las demás', async () => {
    const e = await crearEntorno([productor, consumidor]);
    let fallar = true;
    const recibidosPorOtra: string[] = [];
    e.bus.registrar(
      'contador',
      registrarVistos(['tareas.TareaCompletada'], {
        async manejar(evento, tx) {
          await tx.poner('vistos', { id: evento.id, tipo: evento.tipo });
          if (fallar) throw new Error('fallo simulado');
        },
      }),
    );
    e.bus.registrar('tareas', {
      id: 'tareas.auditoria',
      tipos: '*',
      almacenes: [],
      async manejar(evento) {
        recibidosPorOtra.push(evento.tipo);
      },
    });
    await e.bus.iniciar();
    await completar(e, 'a');
    await e.bus.procesarPendientes();

    expect(await vistos(e)).toHaveLength(0); // se deshizo
    expect(recibidosPorOtra).toEqual(['tareas.TareaCompletada']);
    const estado = await e.bus.estado();
    expect(estado.find((s) => s.id === 'contador.vistos')?.bloqueo?.mensaje).toBe('fallo simulado');
    expect(e.diagnostico.entradas.some((d) => d.nivel === 'error')).toBe(true);

    fallar = false;
    await e.bus.desbloquear('contador.vistos');
    expect(await vistos(e)).toHaveLength(1);
  });

  it('procesa eventos publicados por una suscripción (cadenas)', async () => {
    const e = await crearEntorno([productor, consumidor]);
    const cadena: string[] = [];
    e.bus.registrar('contador', {
      id: 'contador.hitos',
      tipos: ['tareas.TareaCompletada'],
      almacenes: [],
      async manejar(_evento, tx) {
        tx.publicar('contador.HitoAlcanzado', {});
      },
    });
    e.bus.registrar('tareas', {
      id: 'tareas.escucha',
      tipos: ['contador.HitoAlcanzado'],
      almacenes: [],
      async manejar(evento: EventoDeDominio) {
        cadena.push(evento.tipo);
      },
    });
    await e.bus.iniciar();
    await completar(e, 'a');
    await e.bus.procesarPendientes();
    expect(cadena).toEqual(['contador.HitoAlcanzado']);
  });

  it('una suscripción "desdeAhora" ignora el historial previo', async () => {
    const e = await crearEntorno([productor, consumidor]);
    await completar(e, 'viejo');
    const e2 = await e.reabrir();
    e2.bus.registrar('contador', registrarVistos(['tareas.TareaCompletada'], { historial: 'desdeAhora' }));
    await e2.bus.iniciar();
    await completar(e2, 'nuevo');
    await e2.bus.procesarPendientes();
    expect(await vistos(e2)).toHaveLength(1);
  });

  it('una suscripción "completo" (por defecto) procesa el historial al registrarse', async () => {
    const e = await crearEntorno([productor, consumidor]);
    await completar(e, 'a');
    await completar(e, 'b');
    const e2 = await e.reabrir();
    e2.bus.registrar('contador', registrarVistos());
    await e2.bus.iniciar();
    expect(await vistos(e2)).toHaveLength(2);
  });

  it('rechaza suscripciones duplicadas o con tipos mal formados', async () => {
    const e = await crearEntorno([productor, consumidor]);
    e.bus.registrar('contador', registrarVistos());
    expect(() => e.bus.registrar('contador', registrarVistos())).toThrow(/duplicada/);
    expect(() => e.bus.registrar('contador', registrarVistos(['malo'], { id: 'x' }))).toThrow(/inválido/);
  });
});
