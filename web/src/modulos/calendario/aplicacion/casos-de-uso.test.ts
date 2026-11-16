/**
 * Casos de uso del Calendario contra IndexedDB en memoria, con el bus real.
 * Todo es local: los escenarios "sin conexión" se cumplen porque nada usa la red.
 */
import { avisadorNulo } from '../../../nucleo/infraestructura/avisos';
import { describe, expect, it, vi } from 'vitest';
import type { AlmacenDeModulo, ContextoDeModulo, Notificador } from '../../../nucleo/contrato';
import { definirModulo } from '../../../nucleo/contrato';
import { crearFormatos, crearTraductor } from '../../../nucleo/i18n/traductor';
import { crearEntorno, type Entorno } from '../../../pruebas/entorno';
import { integracionesVacias } from '../../../nucleo/aplicacion/integraciones';
import type { Integraciones } from '../../../nucleo/contrato';
import rpg from '../../rpg/modulo';
import { leerPerfil } from '../../rpg/aplicacion/registrar-experiencia';
import type { DatosDeEvento, EventoDeCalendario } from '../dominio/evento';
import { CumplimientoFueraDeTiempo, FinAntesDeInicio } from '../dominio/errores';
import calendario from '../modulo';
import textos from '../textos.es-CO.json';
import { AGENDA, AVISOS, EVENTOS, FICHAS, REVISIONES, zonaDelUsuario, type RegistroDeAgenda } from './comun';
import {
  cancelarOcurrencia,
  crearEvento,
  desmarcarCumplido,
  editarEvento,
  editarOcurrencia,
  eliminarEvento,
  marcarCumplido,
  restaurarOcurrencia,
} from './eventos';
import { combinar, leerFuentes, leerFuentesRegistradas, visiblesEnRango, type IdDeFuente } from './fuentes';
import { generarIcs, importarEventos, leerParaExportar, prepararImportacion } from './importar-exportar';
import { descartarAvisos, leerBandeja, revisarRecordatorios } from './recordatorios';
import { planificarSemana } from './revision-semanal';
import { colocarFicha, crearFicha, crearProveedoresDelCalendario, editarFicha, eliminarFicha } from './fichas';
import { crearIntegraciones } from '../../../nucleo/aplicacion/integraciones';

/** Módulo de prueba que publica elementos de agenda (como lo haría Universidad). */
const otro = definirModulo({
  id: 'otro',
  version: '1.0.0',
  nombre: 'otro.nombre',
  textos: { 'otro.nombre': 'Otro' },
  rutas: [],
  migraciones: [{ version: 1, descripcion: 'nada', aplicar: (c) => c.crearAlmacen('cosas') }],
  eventos: { 'otro.Algo': { version: 1, descripcion: 'Publica datos.agenda' } },
});

const HORA = 3_600_000;

async function preparar() {
  const e: Entorno = await crearEntorno([calendario, otro, rpg]);
  const notificados: string[] = [];
  const notificaciones: Notificador = {
    permiso: () => 'concedido',
    pedirPermiso: async () => 'concedido',
    mostrar: async ({ titulo }) => (notificados.push(titulo), true),
  };
  const contexto = (moduloId: string): ContextoDeModulo => ({
    moduloId,
    almacen: e.almacen.paraModulo(moduloId),
    reloj: e.reloj,
    nuevoId: () => e.ids.siguiente(),
    t: crearTraductor({ ...textos }),
    formatos: crearFormatos(),
    diagnostico: e.diagnostico,
    notificaciones,
    integraciones: integracionesVacias,
    avisos: avisadorNulo,
    navegar: () => undefined,
  });
  for (const m of [calendario, rpg]) for (const s of m.suscripciones!(contexto(m.id))) e.bus.registrar(m.id, s);
  await e.bus.iniciar();
  const ctx = contexto('calendario');
  const publicarAgenda = (agenda: unknown) =>
    e.almacen.paraModulo('otro').escribir(['cosas'], async (tx) => {
      tx.publicar('otro.Algo', { agenda });
    });
  const agenda = async () => {
    await e.bus.procesarPendientes();
    return ctx.almacen.leer([AGENDA], (tx) => tx.listar<RegistroDeAgenda>(AGENDA));
  };
  const perfil = async () => {
    await e.bus.procesarPendientes();
    return (await e.almacen.paraModulo('rpg').leer(['perfil'], leerPerfil))?.xpTotal ?? 0;
  };
  const tipos: string[] = [];
  e.almacen.alPublicar((evs) => tipos.push(...evs.filter((x) => x.modulo === 'calendario').map((x) => x.tipo.replace('calendario.', ''))));
  return { e, ctx, notificados, publicarAgenda, agenda, perfil, tipos };
}

const datos = (c: Partial<DatosDeEvento> = {}): DatosDeEvento => ({
  titulo: 'Monitoría',
  lugar: '',
  notas: '',
  color: 'azul',
  todoElDia: false,
  inicio: '2026-11-17T15:00:00Z',
  fin: '2026-11-17T16:00:00Z',
  recordatorios: [],
  recurrencia: null,
  compromiso: false,
  ...c,
});

describe('CA1 · eventos propios', () => {
  it('crear, editar y eliminar publican sus eventos; un intervalo inválido no guarda nada', async () => {
    const { e, ctx, tipos } = await preparar();
    const ev = await crearEvento(ctx, datos());
    await editarEvento(ctx, ev.id, datos({ titulo: 'Monitoría de Cálculo', lugar: 'Bloque B' }));
    await expect(crearEvento(ctx, datos({ fin: '2026-11-17T14:00:00Z' }))).rejects.toThrow(FinAntesDeInicio);
    await eliminarEvento(ctx, ev.id);
    await eliminarEvento(ctx, ev.id); // repetido: no hace nada
    expect(tipos).toEqual(['EventoCreado', 'EventoEditado', 'EventoEliminado']);
    expect(await e.almacen.contarTodo()).toMatchObject({ calendario_eventos: 0 });
  });
});

describe('CA2 · elementos de otros módulos', () => {
  it('proyecta datos.agenda, actualiza su estado y lo quita cuando se elimina', async () => {
    const { publicarAgenda, agenda } = await preparar();
    const base = { id: 'e1', titulo: 'Taller 3', inicio: '2026-11-21T04:59:00.000Z', tipo: 'vencimiento', color: 'verde' };
    await publicarAgenda({ ...base, estado: 'pendiente' });
    expect(await agenda()).toMatchObject([{ clave: 'otro:e1', origen: 'otro', agenda: { estado: 'pendiente' } }]);
    await publicarAgenda({ ...base, estado: 'hecho' });
    expect((await agenda())[0]!.agenda).toMatchObject({ estado: 'hecho' });
    await publicarAgenda({ ...base, estado: 'eliminado' });
    expect(await agenda()).toEqual([]);
  });

  it('un dato mal formado se omite y se anota, sin detener la suscripción', async () => {
    const { e, publicarAgenda, agenda } = await preparar();
    await publicarAgenda({ id: 'malo', titulo: 'x', inicio: 'mañana', tipo: 'vencimiento', estado: 'pendiente' });
    await publicarAgenda({ id: 'bueno', titulo: 'y', inicio: '2026-11-21T04:59:00Z', tipo: 'vencimiento', estado: 'pendiente' });
    expect((await agenda()).map((r) => r.clave)).toEqual(['otro:bueno']);
    expect(e.diagnostico.entradas.some((x) => x.mensaje.includes('inválido'))).toBe(true);
  });

  it('si una fuente falla, se muestra el resto y se informa cuál falló', async () => {
    const { ctx, publicarAgenda } = await preparar();
    await crearEvento(ctx, datos());
    await publicarAgenda({ id: 'e1', titulo: 'Taller', inicio: '2026-11-17T20:00:00Z', tipo: 'vencimiento', estado: 'pendiente' });
    await new Promise((r) => setTimeout(r, 0));
    const rango = { desdeMs: Date.parse('2026-11-16T05:00:00Z'), hastaMs: Date.parse('2026-11-23T05:00:00Z') };

    // Almacén que falla al leer la proyección.
    const roto: AlmacenDeModulo = { ...ctx.almacen, leer: (almacenes, fn) => (almacenes.includes(AGENDA) ? Promise.reject(new Error('IndexedDB')) : ctx.almacen.leer(almacenes, fn)) };
    const conFallo = visiblesEnRango(await leerFuentes(roto), rango, zonaDelUsuario());
    expect(conFallo.elementos.map((x) => x.titulo)).toEqual(['Monitoría']);
    expect(conFallo.fallos).toMatchObject([{ fuente: 'externos', nombre: 'calendario.fuente.externos' }]);

    // Un registro dañado se omite y se cuenta.
    const lectura = await leerFuentes(ctx.almacen);
    const dañada = { ...lectura, registros: new Map<IdDeFuente, readonly unknown[]>([...lectura.registros, ['propios', [...lectura.registros.get('propios')!, { basura: true }]]]) };
    const parcial = visiblesEnRango(dañada, rango, zonaDelUsuario());
    expect(parcial.fallos).toEqual([{ fuente: 'propios', nombre: 'calendario.fuente.propios', omitidos: 1 }]);
  });
});

describe('Fichas (H8, ADR-0015)', () => {
  it('ficha propia: crear, editar y eliminar publican eventos sin XP; el Calendario la ofrece por el núcleo', async () => {
    const { e, ctx, tipos, perfil } = await preparar();
    const f = await crearFicha(ctx, { titulo: 'Gimnasio', color: '#FF7043', duracionMin: 60, repeticion: { tipo: 'semanal', semanas: 8 } });
    await editarFicha(ctx, f.id, { titulo: 'Gym', color: 'rojo', duracionMin: 90, repeticion: { tipo: 'unica' } });
    const integraciones = crearIntegraciones([calendario], () => ctx as ContextoDeModulo);
    expect((await integraciones.fichas()).grupos).toEqual([{ modulo: 'calendario', nombre: 'calendario.fichasPropias', fichas: [{ id: f.id, titulo: 'Gym', color: 'rojo', duracionMin: 90, repeticion: { tipo: 'unica' } }] }]);
    await eliminarFicha(ctx, f.id);
    await eliminarFicha(ctx, f.id); // idempotente (deshacer diferido)
    expect((await crearProveedoresDelCalendario(ctx).fichas!.fichas())).toEqual([]);
    expect(tipos).toEqual(['FichaCreada', 'FichaEditada', 'FichaEliminada']);
    expect(await perfil()).toBe(0);
    expect(e).toBeDefined();
  });

  it('poner la ficha de una materia crea la clase semanal vinculada; quitarla borra la serie', async () => {
    const { ctx, tipos } = await preparar();
    const ficha = { id: 'm1', titulo: 'Cálculo II', color: 'verde' as const, duracionMin: 120, repeticion: { tipo: 'semanal' as const, semanas: 16 }, vinculo: { tipo: 'universidad.materia', id: 'm1' } };
    const ev = await colocarFicha(ctx, 'universidad', ficha, zonaDelUsuario().aUtc('2026-11-16', 7 * 60));
    expect(ev).toMatchObject({ ficha: 'universidad:m1', vinculo: { tipo: 'universidad.materia', id: 'm1' }, recurrencia: { dias: [1], fin: { veces: 16 } } });
    const semana = { desdeMs: Date.parse('2026-11-16T05:00:00Z'), hastaMs: Date.parse('2026-11-23T05:00:00Z') };
    const v = visiblesEnRango(await leerFuentes(ctx.almacen), semana, zonaDelUsuario());
    expect(v.elementos).toMatchObject([{ titulo: 'Cálculo II', ficha: 'universidad:m1', fechaInicio: '2026-11-16' }]);
    await eliminarEvento(ctx, ev.id);
    expect(visiblesEnRango(await leerFuentes(ctx.almacen), semana, zonaDelUsuario()).elementos).toEqual([]);
    expect(tipos).toEqual(['EventoCreado', 'EventoEliminado']);
  });

  it('migración v2: una base de la 0.4 (esquema v1, sin fichas) sube a v2 y sus eventos siguen igual', async () => {
    const v1 = { ...calendario, migraciones: calendario.migraciones.slice(0, 1) };
    const e = await crearEntorno([v1]);
    // Registro tal como lo guardaba la 0.4: sin vinculo ni ficha.
    await e.almacen.paraModulo('calendario').escribir([EVENTOS], (tx) =>
      tx.poner(EVENTOS, { id: 'viejo', uid: 'viejo@ludus', ...datos(), excepciones: {}, cumplidas: [], creadoEn: '2026-11-01T00:00:00.000Z', actualizadoEn: '2026-11-01T00:00:00.000Z' }),
    );
    const nuevo = await e.reabrir([calendario]);
    const almacen = nuevo.almacen.paraModulo('calendario');
    const v = visiblesEnRango(await leerFuentes(almacen), { desdeMs: Date.parse('2026-11-17T00:00:00Z'), hastaMs: Date.parse('2026-11-18T05:00:00Z') }, zonaDelUsuario());
    expect(v.elementos[0]).toMatchObject({ titulo: 'Monitoría', vinculo: null, ficha: null });
    expect(await almacen.leer([FICHAS], (tx) => tx.listar(FICHAS))).toEqual([]);
  });
});

describe('Fuentes registradas por otros módulos (ADR-0013)', () => {
  it('se suman a lo propio; una que falla se informa sola; la proyección del mismo módulo no se duplica', async () => {
    const { ctx, publicarAgenda } = await preparar();
    await crearEvento(ctx, datos());
    // El módulo "otro" publicó por eventos (proyección) Y además registra una fuente: debe verse una sola vez.
    await publicarAgenda({ id: 'e1', titulo: 'Taller (copia vieja)', inicio: '2026-11-17T20:00:00Z', tipo: 'vencimiento', estado: 'pendiente' });
    await new Promise((r) => setTimeout(r, 0));
    const fuente = (id: string, elementos: () => Promise<unknown[]>) => ({ id, nombre: `${id}.nombre`, elementos, alCambiar: () => () => undefined }) as never;
    const integraciones: Integraciones = {
      ...integracionesVacias,
      fuentesDeCalendario: () => [
        { modulo: 'otro', fuente: fuente('otro.entregas', async () => [{ id: 'e1', titulo: 'Taller 3', inicio: '2026-11-17T20:00:00Z', tipo: 'vencimiento', estado: 'pendiente', ruta: '/otro/e1' }, { id: 'malo', titulo: 'x', inicio: 'ayer', tipo: 'vencimiento', estado: 'pendiente' }]) },
        { modulo: 'roto', fuente: fuente('roto.cosas', async () => Promise.reject(new Error('caído'))) },
      ],
    };
    const rango = { desdeMs: Date.parse('2026-11-16T05:00:00Z'), hastaMs: Date.parse('2026-11-23T05:00:00Z') };
    const zona = zonaDelUsuario();
    const registradas = await leerFuentesRegistradas(integraciones, rango, zona);
    const v = combinar(visiblesEnRango(await leerFuentes(ctx.almacen), rango, zona, registradas.origenes), registradas);
    expect(v.elementos.map((x) => x.titulo)).toEqual(['Monitoría', 'Taller 3']);
    expect(v.elementos[1]).toMatchObject({ fuente: 'externo', origen: 'otro', ruta: '/otro/e1' });
    expect(v.fallos).toMatchObject([
      { fuente: 'otro.entregas', omitidos: 1 },
      { fuente: 'roto.cosas', nombre: 'roto.cosas.nombre' },
    ]);
  });
});

describe('CA5–CA7 · series y ocurrencias', () => {
  const clase = datos({
    titulo: 'Física I',
    inicio: '2026-11-16T12:00:00Z',
    fin: '2026-11-16T14:00:00Z',
    recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1, 3], fin: { tipo: 'conteo', veces: 30 } },
  });

  it('borrar solo una ocurrencia se puede deshacer (devuelve la excepción anterior)', async () => {
    const { ctx, tipos } = await preparar();
    const ev = await crearEvento(ctx, clase);
    await editarOcurrencia(ctx, ev.id, '2026-11-18', { titulo: 'Física I (aula 3)', lugar: '', notas: '', inicio: '2026-11-18T12:00:00Z', fin: '2026-11-18T14:00:00Z' });
    const anterior = await cancelarOcurrencia(ctx, ev.id, '2026-11-18');
    expect(anterior).toMatchObject({ cancelada: false, titulo: 'Física I (aula 3)' });
    await restaurarOcurrencia(ctx, ev.id, '2026-11-18', anterior);
    const guardado = await ctx.almacen.leer([EVENTOS], (tx) => tx.obtener<EventoDeCalendario>(EVENTOS, ev.id));
    expect(guardado!.excepciones['2026-11-18']).toMatchObject({ titulo: 'Física I (aula 3)' });
    expect(tipos).toEqual(['EventoCreado', 'OcurrenciaModificada', 'OcurrenciaModificada', 'OcurrenciaModificada']);
  });
});

describe('CA8 · recordatorios', () => {
  it('notifica una sola vez lo que vence con la app abierta; la bandeja muestra lo vencido hasta descartarlo', async () => {
    const { e, ctx, notificados } = await preparar();
    // El reloj de las pruebas empieza el 14 nov a las 15:00Z.
    await crearEvento(ctx, datos({ titulo: 'Parcial', inicio: '2026-11-14T16:00:00Z', fin: '2026-11-14T18:00:00Z', recordatorios: [30, 60] }));
    const inicio = e.reloj.ahora().getTime();
    e.reloj.avanzar(HORA / 2); // 15:30Z: vence el de 30 min; el de 60 min venció justo en "desde" (no se notifica, queda en la bandeja)
    const desde = await revisarRecordatorios(ctx, inicio);
    expect(notificados).toEqual(['Parcial']); // el de 30 min (15:30)
    await revisarRecordatorios(ctx, desde - HORA); // aunque se repita la ventana, no se repite
    expect(notificados).toEqual(['Parcial']);

    const bandeja = await ctx.almacen.leer([EVENTOS, AVISOS], (tx) => leerBandeja(tx, e.reloj.ahora().getTime()));
    expect(bandeja.map((a) => a.minutos)).toEqual([60, 30]);
    await descartarAvisos(ctx, bandeja.slice(0, 1));
    expect(await ctx.almacen.leer([EVENTOS, AVISOS], (tx) => leerBandeja(tx, e.reloj.ahora().getTime()))).toHaveLength(1);
  });
});

describe('CA10–CA11 · .ics', () => {
  it('exportar e importar en otro dispositivo crea; reimportar actualiza sin duplicar', async () => {
    const a = await preparar();
    const ev = await crearEvento(a.ctx, datos({ titulo: 'Física I', recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [2], fin: { tipo: 'nunca' } }, recordatorios: [10] }));
    await cancelarOcurrencia(a.ctx, ev.id, '2026-11-24');
    const texto = await generarIcs(await a.ctx.almacen.leer([EVENTOS, AGENDA], (tx) => leerParaExportar(tx, false)), a.e.reloj.ahora());

    const b = await preparar();
    const previa = await prepararImportacion(texto, b.e.reloj.ahora(), 'gris');
    expect(previa.validos).toHaveLength(1);
    expect(await importarEventos(b.ctx, previa.validos)).toEqual({ creados: 1, actualizados: 0 });
    expect(await importarEventos(b.ctx, previa.validos)).toEqual({ creados: 0, actualizados: 1 });
    const [importado] = await b.ctx.almacen.leer([EVENTOS], (tx) => tx.listar<EventoDeCalendario>(EVENTOS));
    expect(importado).toMatchObject({ uid: ev.uid, titulo: 'Física I', recordatorios: [10], excepciones: { '2026-11-24': { cancelada: true } } });
  });

  it('la vista previa explica lo que no se puede importar', async () => {
    const { e } = await preparar();
    const texto = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:largo', 'SUMMARY:Viaje', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20270101', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const previa = await prepararImportacion(texto, e.reloj.ahora(), 'azul');
    expect(previa.validos).toEqual([]);
    expect(previa.avisos).toEqual([{ motivo: 'invalido', titulo: 'Viaje', error: 'calendario.error.duracion' }]);
  });
});

describe('CA12 y C6 · XP del Calendario', () => {
  it('cumplir un bloque de compromiso da 15 XP una sola vez por ocurrencia', async () => {
    const { e, ctx, perfil } = await preparar();
    const bloque = await crearEvento(ctx, datos({ titulo: 'Estudio', compromiso: true, inicio: '2026-11-14T13:00:00Z', fin: '2026-11-14T14:30:00Z' }));
    await marcarCumplido(ctx, bloque.id, '2026-11-14');
    expect(await perfil()).toBe(15);
    await desmarcarCumplido(ctx, bloque.id, '2026-11-14');
    await marcarCumplido(ctx, bloque.id, '2026-11-14');
    expect(await perfil()).toBe(15);
    e.reloj.avanzar(72 * HORA);
    await desmarcarCumplido(ctx, bloque.id, '2026-11-14');
    await expect(marcarCumplido(ctx, bloque.id, '2026-11-14')).rejects.toThrow(CumplimientoFueraDeTiempo);
  });

  it('planificar la semana publica una vez y da 30 XP', async () => {
    const { ctx, perfil, tipos } = await preparar();
    const r = await planificarSemana(ctx);
    await planificarSemana(ctx);
    expect(r.semana).toBe('2026-W46');
    expect(tipos).toEqual(['SemanaPlanificada']);
    expect(await perfil()).toBe(30);
    expect(await ctx.almacen.leer([REVISIONES], (tx) => tx.listar(REVISIONES))).toHaveLength(1);
  });
});

it('el calendario no importa código de otros módulos (solo lee datos.agenda)', () => {
  const archivos = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  for (const [ruta, codigo] of Object.entries(archivos)) {
    if (ruta.endsWith('.test.ts')) continue;
    expect(codigo, ruta).not.toMatch(/from '\.\.\/\.\.\/(universidad|rpg|ejemplo)\//);
  }
  vi.restoreAllMocks();
});
