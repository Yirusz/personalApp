/**
 * Reglas de dominio de Universidad, escritas a partir de los criterios
 * Dado/Cuando/Entonces de U1–U6 (docs/story-map.md).
 */
import { describe, expect, it } from 'vitest';
import { filtrarEntregables, proximosVencimientos } from './consultas';
import {
  completar,
  editar,
  elementoDeAgenda,
  estaVencido,
  iniciar,
  reabrir,
  registrarEntregable,
  reprogramar,
  type Entregable,
} from './entregable';
import {
  EntregableYaCompletado,
  FechaInvalida,
  MateriaArchivadaSinEntregables,
  MateriaRepetida,
  NombreDeMateriaInvalido,
  TallaBloqueada,
  TituloInvalido,
  TransicionInvalida,
  ColorInvalido,
  CreditosInvalidos,
} from './errores';
import { archivar, asegurarNombreUnico, crearMateria, renombrar, restaurar, type Materia } from './materia';

const AHORA = new Date('2026-11-14T15:00:00Z'); // sábado 10:00 a. m. en Bogotá
const horas = (h: number) => new Date(AHORA.getTime() + h * 3_600_000);

function unaMateria(cambios: Partial<Parameters<typeof crearMateria>[0]> = {}): Materia {
  return crearMateria({ id: 'm1', nombre: 'Física I', color: 'azul', creditos: 3, ...cambios }, AHORA);
}

function unEntregable(cambios: Partial<Parameters<typeof registrarEntregable>[0]> = {}, ahora = AHORA): Entregable {
  return registrarEntregable(
    {
      id: 'e1',
      materia: unaMateria(),
      titulo: 'Taller 3',
      tipo: 'tarea',
      venceEn: '2026-11-21T04:59:00.000Z', // viernes 20, 23:59 en Bogotá
      prioridad: 'alta',
      talla: 'M',
      ...cambios,
    },
    ahora,
  ).entregable;
}

describe('U1 · Materia', () => {
  it('crea "Cálculo II" con color verde', () => {
    const m = crearMateria({ id: 'm1', nombre: '  Cálculo   II ', color: 'verde', creditos: null }, AHORA);
    expect(m).toEqual({
      id: 'm1',
      nombre: 'Cálculo II',
      color: 'verde',
      creditos: null,
      archivada: false,
      creadaEn: AHORA.toISOString(),
      actualizadaEn: AHORA.toISOString(),
    });
  });

  it('nombre vacío o de más de 60 caracteres no es válido', () => {
    expect(() => unaMateria({ nombre: '   ' })).toThrow(NombreDeMateriaInvalido);
    expect(() => unaMateria({ nombre: 'x'.repeat(61) })).toThrow(NombreDeMateriaInvalido);
    expect(unaMateria({ nombre: 'x'.repeat(60) }).nombre).toHaveLength(60);
  });

  it('color fuera de la paleta y créditos fuera de 0–10 no son válidos', () => {
    expect(() => unaMateria({ color: '#ff0000' as never })).toThrow(ColorInvalido);
    expect(() => unaMateria({ creditos: 11 })).toThrow(CreditosInvalidos);
    expect(() => unaMateria({ creditos: 2.5 })).toThrow(CreditosInvalidos);
    expect(unaMateria({ creditos: 0 }).creditos).toBe(0);
  });

  it('nombre repetido entre las activas, sin distinguir mayúsculas', () => {
    const activas = [unaMateria({ id: 'a', nombre: 'Cálculo II' })];
    expect(() => asegurarNombreUnico('cálculo ii', activas)).toThrow(MateriaRepetida);
    expect(() => asegurarNombreUnico('CÁLCULO  II', activas)).toThrow(MateriaRepetida);
    expect(() => asegurarNombreUnico('Cálculo III', activas)).not.toThrow();
    // Renombrar la misma materia con otras mayúsculas sí se permite.
    expect(() => asegurarNombreUnico('cálculo ii', activas, 'a')).not.toThrow();
  });
});

describe('U2 · Editar y archivar materia', () => {
  it('renombra y actualiza la fecha de modificación', () => {
    const m = renombrar(unaMateria(), 'Física II', horas(1));
    expect(m).toMatchObject({ nombre: 'Física II', actualizadaEn: horas(1).toISOString() });
  });

  it('archiva y restaura; no se archiva dos veces', () => {
    const archivada = archivar(unaMateria(), AHORA);
    expect(archivada.archivada).toBe(true);
    expect(() => archivar(archivada, AHORA)).toThrow(TransicionInvalida);
    expect(restaurar(archivada, AHORA).archivada).toBe(false);
    expect(() => restaurar(unaMateria(), AHORA)).toThrow(TransicionInvalida);
  });

  it('una materia archivada no recibe entregables nuevos', () => {
    expect(() => unEntregable({ materia: archivar(unaMateria(), AHORA) })).toThrow(MateriaArchivadaSinEntregables);
  });
});

describe('U3 · Registrar entregable', () => {
  it('registra "Taller 3" para el viernes 23:59, prioridad alta, talla M', () => {
    const { entregable, antelacionHoras } = registrarEntregable(
      {
        id: 'e1',
        materia: unaMateria(),
        titulo: ' Taller 3 ',
        tipo: 'tarea',
        venceEn: '2026-11-21T04:59:00Z',
        prioridad: 'alta',
        talla: 'M',
      },
      AHORA,
    );
    expect(entregable).toEqual({
      id: 'e1',
      materiaId: 'm1',
      titulo: 'Taller 3',
      tipo: 'tarea',
      venceEn: '2026-11-21T04:59:00.000Z',
      prioridad: 'alta',
      talla: 'M',
      estado: 'pendiente',
      creadoEn: AHORA.toISOString(),
      actualizadoEn: AHORA.toISOString(),
    });
    expect(antelacionHoras).toBe(157); // 6 días y 13 h 59 min → 157 h completas
  });

  it('una fecha en el pasado se acepta (registro de algo ya vencido) y queda vencido', () => {
    const e = unEntregable({ venceEn: horas(-2).toISOString() });
    expect(estaVencido(e, AHORA)).toBe(true);
  });

  it('título vacío o de más de 120 caracteres, y fecha inválida, no se aceptan', () => {
    expect(() => unEntregable({ titulo: '  ' })).toThrow(TituloInvalido);
    expect(() => unEntregable({ titulo: 'x'.repeat(121) })).toThrow(TituloInvalido);
    expect(() => unEntregable({ venceEn: 'viernes' })).toThrow(FechaInvalida);
  });

  it('rechaza tipo, prioridad o talla fuera de catálogo', () => {
    expect(() => unEntregable({ tipo: 'examen' as never })).toThrow(RangeError);
    expect(() => unEntregable({ prioridad: 'urgente' as never })).toThrow(RangeError);
    expect(() => unEntregable({ talla: 'XL' as never })).toThrow(RangeError);
  });

  it('su elemento de agenda es un vencimiento puntual con el color de la materia', () => {
    expect(elementoDeAgenda(unEntregable(), 'azul')).toEqual({
      id: 'e1',
      titulo: 'Taller 3',
      inicio: '2026-11-21T04:59:00.000Z',
      tipo: 'vencimiento',
      estado: 'pendiente',
      color: 'azul',
    });
  });
});

describe('U4 · Avanzar el estado', () => {
  it('completar a tiempo registra la hora actual y calcula aTiempo y minutos desde la creación', () => {
    const creado = unEntregable({ venceEn: horas(24).toISOString() });
    const resultado = completar(creado, horas(3));
    expect(resultado.entregable).toMatchObject({ estado: 'completado', completadoEn: horas(3).toISOString() });
    expect(resultado.aTiempo).toBe(true);
    expect(resultado.minutosDesdeCreacion).toBe(180);
    expect(elementoDeAgenda(resultado.entregable, 'azul').estado).toBe('hecho');
  });

  it('completar después del vencimiento no es a tiempo (sin castigo: solo el dato)', () => {
    const r = completar(unEntregable({ venceEn: horas(1).toISOString() }), horas(2));
    expect(r.aTiempo).toBe(false);
  });

  it('pendiente → en curso → completado; no se completa dos veces sin reabrir', () => {
    const enCurso = iniciar(unEntregable(), AHORA);
    expect(enCurso.estado).toBe('enCurso');
    expect(() => iniciar(enCurso, AHORA)).toThrow(TransicionInvalida);
    const { entregable: hecho } = completar(enCurso, horas(1));
    expect(() => completar(hecho, horas(2))).toThrow(EntregableYaCompletado);
    expect(() => iniciar(hecho, horas(2))).toThrow(TransicionInvalida);
  });

  it('la talla se bloquea al empezar', () => {
    expect(editar(unEntregable(), { talla: 'L' }, AHORA).talla).toBe('L');
    const enCurso = iniciar(unEntregable(), AHORA);
    expect(() => editar(enCurso, { talla: 'L' }, AHORA)).toThrow(TallaBloqueada);
    // Mismo valor: no es un cambio.
    expect(editar(enCurso, { talla: 'M', titulo: 'Taller 3b' }, AHORA).titulo).toBe('Taller 3b');
  });

  it('reabrir vuelve a "en curso", borra completadoEn y mantiene la talla bloqueada', () => {
    const { entregable: hecho } = completar(unEntregable(), horas(1));
    const reabierto = reabrir(hecho, horas(2));
    expect(reabierto.estado).toBe('enCurso');
    expect(reabierto).not.toHaveProperty('completadoEn');
    expect(() => editar(reabierto, { talla: 'S' }, horas(2))).toThrow(TallaBloqueada);
    expect(() => reabrir(reabierto, horas(2))).toThrow(TransicionInvalida);
  });
});

describe('U6 · Reprogramar', () => {
  it('cambia la fecha y devuelve la anterior', () => {
    const r = reprogramar(unEntregable(), '2026-11-24T04:59:00Z', horas(1));
    expect(r.venceEnAnterior).toBe('2026-11-21T04:59:00.000Z');
    expect(r.entregable.venceEn).toBe('2026-11-24T04:59:00.000Z');
  });

  it('no se reprograma un entregable completado (primero se reabre)', () => {
    const { entregable: hecho } = completar(unEntregable(), horas(1));
    expect(() => reprogramar(hecho, '2026-11-24T04:59:00Z', horas(1))).toThrow(EntregableYaCompletado);
  });
});

describe('U5 · Lista y próximos vencimientos', () => {
  const lista = [
    unEntregable({ id: 'a', venceEn: horas(80).toISOString() }),
    unEntregable({ id: 'b', venceEn: horas(30).toISOString() }),
    unEntregable({ id: 'c', venceEn: horas(100).toISOString() }),
    unEntregable({ id: 'd', venceEn: horas(10).toISOString() }),
    unEntregable({ id: 'e', venceEn: horas(200).toISOString() }),
  ];

  it('con 2 que vencen en menos de 72 h y 3 después, muestra los 2, el más cercano primero', () => {
    expect(proximosVencimientos(lista, AHORA).map((e) => e.id)).toEqual(['d', 'b']);
  });

  it('incluye los vencidos sin completar y excluye los completados', () => {
    const vencido = unEntregable({ id: 'v', venceEn: horas(-5).toISOString() });
    const hecho = completar(unEntregable({ id: 'h', venceEn: horas(5).toISOString() }), AHORA).entregable;
    expect(proximosVencimientos([...lista, vencido, hecho], AHORA).map((e) => e.id)).toEqual(['v', 'd', 'b']);
  });

  it('filtra por materia y estado; "activos" = pendientes y en curso', () => {
    const otra = unEntregable({ id: 'x', materia: unaMateria({ id: 'm2', nombre: 'Cálculo II' }) });
    const enCurso = iniciar(unEntregable({ id: 'y' }), AHORA);
    const hecho = completar(unEntregable({ id: 'z' }), AHORA).entregable;
    const todos = [otra, enCurso, hecho, ...lista];
    const activas = new Set(['m1', 'm2']);

    const fisicaPendientes = filtrarEntregables(todos, { materiaId: 'm1', estado: 'pendiente' }, activas);
    expect(fisicaPendientes.map((e) => e.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
    expect(filtrarEntregables(todos, { materiaId: null, estado: 'activos' }, activas)).toHaveLength(7);
    expect(filtrarEntregables(todos, { materiaId: null, estado: 'completado' }, activas).map((e) => e.id)).toEqual(['z']);
  });

  it('oculta los entregables de materias archivadas (siguen guardados en el historial)', () => {
    expect(filtrarEntregables(lista, { materiaId: null, estado: 'todos' }, new Set())).toEqual([]);
  });
});
