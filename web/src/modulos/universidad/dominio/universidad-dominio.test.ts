/**
 * Reglas de dominio de Universidad v2 (historias 1–6 de la revisión del módulo).
 * Reloj fijo: domingo 15 nov 2026, 10:00 en Bogotá (15:00Z).
 */
import { describe, expect, it } from 'vitest';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import { agruparProximas, filtrarTrabajos, indicador } from './consultas';
import {
  EstadoNoPermite,
  MateriaArchivadaSinTrabajos,
  MateriaRepetida,
  NotaInvalida,
  PesoInvalido,
  PeriodoInvalido,
  SubtareaInvalida,
  TipoBloqueado,
  TituloInvalido,
} from './errores';
import { archivar, asegurarNombreUnico, crearMateria, editarMateria, materiaDesdeAlmacen, periodoSugerido, restaurar, type Materia } from './materia';
import { notaDesdeTexto, pesoDesdeTexto, textoDeNota, textoDePeso } from './nota';
import {
  agregarSubtarea,
  calificar,
  cancelar,
  editarTrabajo,
  elementoDeAgenda,
  entregar,
  iniciar,
  marcarSubtarea,
  progreso,
  quitarSubtarea,
  reabrir,
  registrarTrabajo,
  reprogramar,
  trabajoDesdeAlmacen,
  transicionesPosibles,
  type DatosDeTrabajo,
  type Trabajo,
} from './trabajo';

const BOGOTA = crearZona('America/Bogota');
const AHORA = new Date('2026-11-15T15:00:00Z');
const horas = (h: number) => new Date(AHORA.getTime() + h * 3_600_000);

const materia = (c: Partial<Parameters<typeof crearMateria>[0]> = {}): Materia =>
  crearMateria({ id: 'm1', nombre: 'Física I', profesor: 'Ana Gómez', color: 'azul', periodo: '2026-2', creditos: 3, ...c }, AHORA);

const trabajo = (c: Partial<DatosDeTrabajo> = {}, ahora = AHORA): Trabajo =>
  registrarTrabajo(
    {
      id: 't1',
      materia: materia(),
      titulo: 'Taller 3',
      tipo: 'taller',
      descripcion: '',
      venceEn: '2026-11-21T04:59:00Z', // viernes 20, 23:59
      prioridad: 'alta',
      peso: null,
      ...c,
    },
    ahora,
  ).trabajo;

describe('1 · Materias', () => {
  it('crea con profesor y periodo académico; el periodo sugerido sale de la fecha', () => {
    expect(materia({ profesor: '  Ana   Gómez ' })).toMatchObject({ nombre: 'Física I', profesor: 'Ana Gómez', periodo: '2026-2', archivada: false });
    expect(periodoSugerido('2026-03-10')).toBe('2026-1');
    expect(periodoSugerido('2026-11-15')).toBe('2026-2');
    expect(() => materia({ periodo: ' ' })).toThrow(PeriodoInvalido);
  });

  it('el nombre es único entre las activas del MISMO periodo (repetir la materia otro semestre sí se puede)', () => {
    const activas = [materia()];
    expect(() => asegurarNombreUnico('física i', '2026-2', activas)).toThrow(MateriaRepetida);
    expect(() => asegurarNombreUnico('Física I', '2027-1', activas)).not.toThrow();
    expect(() => asegurarNombreUnico('física i', '2026-2', activas, 'm1')).not.toThrow();
  });

  it('se edita todo (también el color) y se archiva/restaura', () => {
    const e = editarMateria(materia(), { nombre: 'Física II', profesor: '', color: 'verde', periodo: '2027-1', creditos: null }, horas(1));
    expect(e).toMatchObject({ nombre: 'Física II', profesor: '', color: 'verde', periodo: '2027-1', creditos: null });
    expect(restaurar(archivar(e, AHORA), AHORA).archivada).toBe(false);
  });

  it('una materia guardada antes (sin profesor ni periodo) se lee con valores por defecto', () => {
    const vieja = { id: 'v', nombre: 'Química', color: 'rojo', creditos: null, archivada: false, creadaEn: '2026-03-02T15:00:00.000Z', actualizadaEn: '2026-03-02T15:00:00.000Z' };
    expect(materiaDesdeAlmacen(vieja)).toMatchObject({ profesor: '', periodo: '2026-1' });
  });
});

describe('Nota y peso (value objects en enteros)', () => {
  it('la nota 0,0–5,0 se guarda en décimas, acepta coma o punto y nunca opera con flotantes', () => {
    expect(notaDesdeTexto('3,7')).toBe(37);
    expect(notaDesdeTexto('4.0')).toBe(40);
    expect(notaDesdeTexto('5')).toBe(50);
    expect(notaDesdeTexto(' 0 ')).toBe(0);
    for (const mala of ['5,1', '-1', '3,75', 'tres', '', '10']) expect(() => notaDesdeTexto(mala), mala).toThrow(NotaInvalida);
    expect(textoDeNota(37)).toBe('3,7');
    expect(textoDeNota(50)).toBe('5,0');
  });

  it('el peso porcentual es opcional y se guarda en décimas de punto', () => {
    expect(pesoDesdeTexto('')).toBeNull();
    expect(pesoDesdeTexto('20')).toBe(200);
    expect(pesoDesdeTexto('12,5')).toBe(125);
    for (const malo of ['0', '101', '12,55', 'x']) expect(() => pesoDesdeTexto(malo), malo).toThrow(PesoInvalido);
    expect(textoDePeso(125)).toBe('12,5 %');
    expect(textoDePeso(200)).toBe('20 %');
  });
});

describe('2 · Registrar trabajos', () => {
  it('registra con tipo, peso y descripción; calcula la antelación', () => {
    const r = registrarTrabajo(
      { id: 't1', materia: materia(), titulo: ' Proyecto final ', tipo: 'proyecto', descripcion: 'Informe + código', venceEn: '2026-11-21T04:59:00Z', prioridad: 'alta', peso: 300 },
      AHORA,
    );
    expect(r.trabajo).toMatchObject({ titulo: 'Proyecto final', tipo: 'proyecto', peso: 300, descripcion: 'Informe + código', estado: 'pendiente', subtareas: [] });
    expect(r.antelacionHoras).toBe(133);
  });

  it('valida título, tipo y materia archivada', () => {
    expect(() => trabajo({ titulo: '' })).toThrow(TituloInvalido);
    expect(() => trabajo({ tipo: 'examen' as never })).toThrow(RangeError);
    expect(() => trabajo({ materia: archivar(materia(), AHORA) })).toThrow(MateriaArchivadaSinTrabajos);
  });
});

describe('3 · Estados y transiciones explícitas', () => {
  it('pendiente → en progreso → entregado (guarda la fecha real) → calificado', () => {
    let t = iniciar(trabajo(), AHORA);
    expect(t.estado).toBe('enProgreso');
    const r = entregar(t, horas(30));
    expect(r).toMatchObject({ aTiempo: true, minutosDesdeCreacion: 1800 });
    expect(r.trabajo).toMatchObject({ estado: 'entregado', entregadoEn: horas(30).toISOString() });
    t = calificar(r.trabajo, 42, horas(100));
    expect(t).toMatchObject({ estado: 'calificado', nota: 42 });
    // Corregir la nota sigue siendo "calificado".
    expect(calificar(t, 45, horas(101)).nota).toBe(45);
  });

  it('"a tiempo" = fecha real ≤ fecha límite, con el reloj inyectado', () => {
    expect(entregar(trabajo(), new Date('2026-11-21T04:59:00Z')).aTiempo).toBe(true);
    expect(entregar(trabajo(), new Date('2026-11-21T05:00:00Z')).aTiempo).toBe(false);
  });

  it('transiciones inválidas: no se califica sin entregar; cancelado/calificado no vuelven a pendiente', () => {
    expect(() => calificar(trabajo(), 40, AHORA)).toThrow(EstadoNoPermite);
    const cancelado = cancelar(trabajo(), AHORA);
    expect(() => iniciar(cancelado, AHORA)).toThrow(EstadoNoPermite);
    expect(() => entregar(cancelado, AHORA)).toThrow(EstadoNoPermite);
    const entregado = entregar(trabajo(), AHORA).trabajo;
    expect(() => cancelar(entregado, AHORA)).toThrow(EstadoNoPermite);
    expect(() => reprogramar(entregado, '2026-11-30T04:59:00Z', AHORA)).toThrow(EstadoNoPermite);
  });

  it('reabrir es deliberado: vuelve a "en progreso" y borra fecha real y nota', () => {
    const calificado = calificar(entregar(trabajo(), AHORA).trabajo, 30, AHORA);
    const r = reabrir(calificado, horas(1));
    expect(r.estado).toBe('enProgreso');
    expect(r).not.toHaveProperty('entregadoEn');
    expect(r).not.toHaveProperty('nota');
    expect(reabrir(cancelar(trabajo(), AHORA), AHORA).estado).toBe('enProgreso');
    expect(() => reabrir(trabajo(), AHORA)).toThrow(EstadoNoPermite);
  });

  it('el tipo y el peso se bloquean una vez entregado (la XP depende de ellos)', () => {
    expect(editarTrabajo(trabajo(), { tipo: 'parcial', peso: 250 }, AHORA)).toMatchObject({ tipo: 'parcial', peso: 250 });
    const entregado = entregar(trabajo(), AHORA).trabajo;
    expect(() => editarTrabajo(entregado, { tipo: 'proyecto' }, AHORA)).toThrow(TipoBloqueado);
    expect(editarTrabajo(entregado, { descripcion: 'link al repo' }, AHORA).descripcion).toBe('link al repo');
  });

  it('acciones posibles por estado (para la UI)', () => {
    expect(transicionesPosibles(trabajo())).toEqual(['iniciar', 'entregar', 'cancelar']);
    expect(transicionesPosibles(entregar(trabajo(), AHORA).trabajo)).toEqual(['calificar', 'reabrir']);
    expect(transicionesPosibles(cancelar(trabajo(), AHORA))).toEqual(['reabrir']);
  });

  it('un entregable guardado con el modelo anterior se lee como trabajo', () => {
    const viejo = { id: 'e', materiaId: 'm1', titulo: 'Taller', tipo: 'trabajo', venceEn: '2026-11-21T04:59:00.000Z', prioridad: 'media', talla: 'M', estado: 'completado', creadoEn: '2026-11-10T15:00:00.000Z', actualizadoEn: '2026-11-12T15:00:00.000Z', completadoEn: '2026-11-12T15:00:00.000Z' };
    const t = trabajoDesdeAlmacen(viejo);
    expect(t).toMatchObject({ tipo: 'taller', estado: 'entregado', entregadoEn: '2026-11-12T15:00:00.000Z', descripcion: '', peso: null, subtareas: [] });
    expect(t).not.toHaveProperty('talla');
    expect(trabajoDesdeAlmacen({ ...viejo, tipo: 'otro', estado: 'enCurso' })).toMatchObject({ tipo: 'tarea', estado: 'enProgreso' });
  });
});

describe('5 · Subtareas (dentro del agregado)', () => {
  it('se agregan, se marcan y se quitan; el progreso se calcula', () => {
    let t = agregarSubtarea(trabajo(), 's1', 'Leer el enunciado', AHORA);
    t = agregarSubtarea(t, 's2', 'Resolver punto 1', AHORA);
    t = marcarSubtarea(t, 's1', true, AHORA);
    expect(progreso(t)).toEqual({ hechas: 1, total: 2 });
    t = quitarSubtarea(t, 's2', AHORA);
    expect(t.subtareas).toEqual([{ id: 's1', texto: 'Leer el enunciado', hecha: true }]);
  });

  it('texto vacío, más de 50 o en un trabajo cancelado no se permiten', () => {
    expect(() => agregarSubtarea(trabajo(), 's', '  ', AHORA)).toThrow(SubtareaInvalida);
    let t = trabajo();
    for (let i = 0; i < 50; i++) t = agregarSubtarea(t, `s${i}`, `paso ${i}`, AHORA);
    expect(() => agregarSubtarea(t, 'x', 'uno más', AHORA)).toThrow(SubtareaInvalida);
    expect(() => agregarSubtarea(cancelar(trabajo(), AHORA), 's', 'x', AHORA)).toThrow(EstadoNoPermite);
  });
});

describe('4 · Próximas entregas: indicadores vencido / hoy / esta semana', () => {
  const t = (id: string, venceEn: string) => trabajo({ id, venceEn } as Partial<DatosDeTrabajo> & { id: string });

  it('clasifica por día y semana locales (lunes a domingo, Bogotá)', () => {
    const ahora = new Date('2026-11-17T15:00:00Z'); // martes 17, 10:00
    expect(indicador(t('a', '2026-11-17T14:00:00Z'), ahora, BOGOTA)).toBe('vencido');
    expect(indicador(t('b', '2026-11-18T04:30:00Z'), ahora, BOGOTA)).toBe('hoy'); // martes 23:30 local
    expect(indicador(t('c', '2026-11-23T04:59:00Z'), ahora, BOGOTA)).toBe('semana'); // domingo 22, 23:59
    expect(indicador(t('d', '2026-11-23T05:00:00Z'), ahora, BOGOTA)).toBe('despues'); // lunes 23, 00:00
    expect(indicador(entregar(t('e', '2026-11-17T14:00:00Z'), ahora).trabajo, ahora, BOGOTA)).toBe('cerrado');
  });

  it('agrupa las activas en orden de urgencia y filtra por materia y estado', () => {
    const ahora = new Date('2026-11-17T15:00:00Z');
    const lista = [t('d', '2026-11-30T04:59:00Z'), t('a', '2026-11-16T04:59:00Z'), t('c', '2026-11-20T04:59:00Z'), t('b', '2026-11-18T03:00:00Z')];
    const grupos = agruparProximas(lista, ahora, BOGOTA);
    expect(grupos.map((g) => [g.indicador, g.trabajos.map((x) => x.id)])).toEqual([
      ['vencido', ['a']],
      ['hoy', ['b']],
      ['semana', ['c']],
      ['despues', ['d']],
    ]);
    const activas = new Set(['m1']);
    const hecho = entregar(t('z', '2026-11-16T04:59:00Z'), ahora).trabajo;
    expect(filtrarTrabajos([...lista, hecho], { materiaId: 'm1', estado: 'entregado' }, activas).map((x) => x.id)).toEqual(['z']);
    expect(filtrarTrabajos([...lista, hecho], { materiaId: null, estado: 'activos' }, activas)).toHaveLength(4);
    expect(filtrarTrabajos(lista, { materiaId: null, estado: 'todos' }, new Set())).toEqual([]);
  });
});

describe('Integración: elemento de agenda para la fuente de calendario', () => {
  it('vencimiento con el color de la materia y la ruta del trabajo; entregado = hecho', () => {
    expect(elementoDeAgenda(trabajo(), 'azul')).toEqual({
      id: 't1',
      titulo: 'Taller 3',
      inicio: '2026-11-21T04:59:00.000Z',
      tipo: 'vencimiento',
      estado: 'pendiente',
      color: 'azul',
      ruta: '/universidad/trabajos/t1',
    });
    expect(elementoDeAgenda(entregar(trabajo(), AHORA).trabajo, 'azul').estado).toBe('hecho');
  });
});
