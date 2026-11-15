import { describe, expect, it } from 'vitest';
import { crearZona } from '../../../nucleo/dominio/zona-horaria';
import { cancelarOcurrencia, crearEvento, editarOcurrencia, type DatosDeEvento } from '../dominio/evento';
import { ArchivoIcsInvalido, escribirIcs, leerIcs } from './ics';

const BOGOTA = crearZona('America/Bogota');
const AHORA = new Date('2026-11-15T15:00:00Z');
const ics = (...lineas: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lineas, 'END:VCALENDAR'].join('\r\n');

describe('leer .ics', () => {
  it('archivo estilo Google: VTIMEZONE, TZID, líneas plegadas, escapes, RRULE semanal y alarma', () => {
    const r = leerIcs(
      ics(
        'X-WR-CALNAME:Horario 2026-2',
        'BEGIN:VTIMEZONE',
        'TZID:America/Bogota',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:-0500',
        'TZOFFSETTO:-0500',
        'DTSTART:19700101T000000',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'UID:abc123@google.com',
        'DTSTART;TZID=America/Bogota:20261116T070000',
        'DTEND;TZID=America/Bogota:20261116T090000',
        'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261205T045959Z;BYDAY=MO,WE',
        'EXDATE;TZID=America/Bogota:20261118T070000',
        'SUMMARY:Física I\\, grupo 2',
        'LOCATION:Edificio 404\\; aula 201',
        'DESCRIPTION:Profesora: Ana\\nTraer calculad',
        ' ora',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'TRIGGER:-PT30M',
        'END:VALARM',
        'END:VEVENT',
      ),
      BOGOTA,
    );
    expect(r.nombre).toBe('Horario 2026-2');
    expect(r.avisos).toEqual([]);
    expect(r.eventos).toHaveLength(1);
    const [e] = r.eventos;
    expect(e).toMatchObject({
      uid: 'abc123@google.com',
      datos: {
        titulo: 'Física I, grupo 2',
        lugar: 'Edificio 404; aula 201',
        notas: 'Profesora: Ana\nTraer calculadora',
        todoElDia: false,
        inicio: '2026-11-16T12:00:00.000Z',
        fin: '2026-11-16T14:00:00.000Z',
        recordatorios: [30],
        recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1, 3], fin: { tipo: 'fecha', hasta: '2026-12-04' } },
      },
      excepciones: { '2026-11-18': { cancelada: true } },
    });
  });

  it('archivo estilo Moodle: UTC y vencimientos con DTSTART = DTEND (se les da 30 min)', () => {
    const r = leerIcs(
      ics('BEGIN:VEVENT', 'UID:1234@moodle.unal.edu.co', 'SUMMARY:Taller 3 vence', 'DTSTART:20261121T045900Z', 'DTEND:20261121T045900Z', 'END:VEVENT'),
      BOGOTA,
    );
    expect(r.eventos[0]!.datos).toMatchObject({ inicio: '2026-11-21T04:59:00.000Z', fin: '2026-11-21T05:29:00.000Z', recurrencia: null, recordatorios: [] });
  });

  it('todo el día: DTEND exclusivo pasa a último día inclusivo; DURATION en días', () => {
    const r = leerIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:a',
        'SUMMARY:Vacaciones',
        'DTSTART;VALUE=DATE:20261231',
        'DTEND;VALUE=DATE:20270102',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:b',
        'SUMMARY:Semana de parciales',
        'DTSTART;VALUE=DATE:20261123',
        'DURATION:P5D',
        'END:VEVENT',
      ),
      BOGOTA,
    );
    expect(r.eventos.map((e) => [e.datos.inicio, e.datos.fin, e.datos.todoElDia])).toEqual([
      ['2026-12-31', '2027-01-01', true],
      ['2026-11-23', '2026-11-27', true],
    ]);
  });

  it('zona de Windows, prefijo de Mozilla y hora flotante', () => {
    const r = leerIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:w',
        'DTSTART;TZID="SA Pacific Standard Time":20261117T100000',
        'DURATION:PT1H30M',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:m',
        'DTSTART;TZID=/mozilla.org/20050126_1/America/Bogota:20261117T100000',
        'DTEND;TZID=/mozilla.org/20050126_1/America/Bogota:20261117T110000',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:f',
        'DTSTART:20261117T100000',
        'DTEND:20261117T110000',
        'END:VEVENT',
      ),
      BOGOTA,
    );
    expect(r.eventos.map((e) => e.datos.inicio)).toEqual(['2026-11-17T15:00:00.000Z', '2026-11-17T15:00:00.000Z', '2026-11-17T15:00:00.000Z']);
    expect(r.eventos[0]!.datos.fin).toBe('2026-11-17T16:30:00.000Z');
    expect(r.eventos[0]!.datos.titulo).toBe('(Sin título)');
  });

  it('lo no soportado se importa con aviso: YEARLY queda como evento único; zona desconocida usa Bogotá', () => {
    const r = leerIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:cumple',
        'SUMMARY:Cumpleaños',
        'DTSTART;VALUE=DATE:20261201',
        'RRULE:FREQ=YEARLY',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:z',
        'SUMMARY:Raro',
        'DTSTART;TZID=Marte/Olympus:20261117T100000',
        'DTEND;TZID=Marte/Olympus:20261117T110000',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:x',
        'SUMMARY:Cancelado',
        'STATUS:CANCELLED',
        'DTSTART:20261117T100000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:y',
        'SUMMARY:Sin fecha',
        'END:VEVENT',
      ),
      BOGOTA,
    );
    expect(r.eventos.map((e) => e.uid)).toEqual(['cumple', 'z']);
    expect(r.eventos[0]!.datos.recurrencia).toBeNull();
    expect(r.avisos.map((a) => [a.motivo, a.titulo])).toEqual([
      ['repeticionNoSoportada', 'Cumpleaños'],
      ['zonaDesconocida', 'Raro'],
      ['zonaDesconocida', 'Raro'],
      ['cancelado', 'Cancelado'],
      ['sinFecha', 'Sin fecha'],
    ]);
  });

  it('RECURRENCE-ID: ocurrencia modificada y ocurrencia cancelada', () => {
    const r = leerIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:clase',
        'SUMMARY:Cálculo',
        'DTSTART:20261117T120000Z',
        'DTEND:20261117T140000Z',
        'RRULE:FREQ=WEEKLY;COUNT=10',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:clase',
        'RECURRENCE-ID:20261124T120000Z',
        'SUMMARY:Cálculo (aula 3)',
        'DTSTART:20261124T140000Z',
        'DTEND:20261124T160000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:clase',
        'RECURRENCE-ID:20261201T120000Z',
        'STATUS:CANCELLED',
        'DTSTART:20261201T120000Z',
        'END:VEVENT',
      ),
      BOGOTA,
    );
    expect(r.eventos[0]!.datos.recurrencia).toMatchObject({ frecuencia: 'semanal', dias: [2], fin: { tipo: 'conteo', veces: 10 } });
    expect(r.eventos[0]!.excepciones).toEqual({
      '2026-11-24': { cancelada: false, titulo: 'Cálculo (aula 3)', lugar: '', notas: '', inicio: '2026-11-24T14:00:00.000Z', fin: '2026-11-24T16:00:00.000Z' },
      '2026-12-01': { cancelada: true },
    });
  });

  it('rechaza lo que no es iCalendar', () => {
    expect(() => leerIcs('hola', BOGOTA)).toThrow(ArchivoIcsInvalido);
  });
});

describe('escribir .ics', () => {
  const datos = (c: Partial<DatosDeEvento>): DatosDeEvento => ({
    titulo: 'Física I',
    lugar: 'Aula 201, edificio 404',
    notas: 'Línea 1\nLínea 2',
    color: 'morado',
    todoElDia: false,
    inicio: '2026-11-17T01:00:00Z', // lunes 16, 20:00 en Bogotá (martes en UTC)
    fin: '2026-11-17T03:00:00Z',
    recordatorios: [10, 1440],
    recurrencia: { frecuencia: 'semanal', intervalo: 1, dias: [1], fin: { tipo: 'fecha', hasta: '2026-12-07' } },
    compromiso: false,
    ...c,
  });

  it('usa hora local con TZID (un lunes 20:00 de Bogotá sigue siendo lunes), VTIMEZONE, UNTIL en UTC y plegado', () => {
    let e = crearEvento({ id: 'e1', ...datos({ titulo: 'Física I — clase nocturna con un título bastante largo para forzar el plegado' }) }, BOGOTA, AHORA);
    e = cancelarOcurrencia(e, '2026-11-23', AHORA, BOGOTA);
    const texto = escribirIcs([e], BOGOTA, AHORA);
    expect(texto).toContain('DTSTART;TZID=America/Bogota:20261116T200000\r\n');
    expect(texto).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261208T045959Z\r\n');
    expect(texto).toContain('EXDATE;TZID=America/Bogota:20261123T200000\r\n');
    expect(texto).toContain('BEGIN:VTIMEZONE');
    expect(texto).toContain('LOCATION:Aula 201\\, edificio 404');
    expect(texto).toContain('TRIGGER:-PT1440M');
    for (const linea of texto.split('\r\n')) expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
  });

  it('ida y vuelta: exportar e importar conserva serie, excepciones, alarmas, color, todo el día y compromiso', () => {
    let serie = crearEvento({ id: 's', ...datos({}) }, BOGOTA, AHORA);
    serie = cancelarOcurrencia(serie, '2026-11-23', AHORA, BOGOTA);
    serie = editarOcurrencia(serie, '2026-11-30', { titulo: 'Física I (recuperación)', lugar: '', notas: '', inicio: '2026-12-01T01:00:00Z', fin: '2026-12-01T02:00:00Z' }, AHORA, BOGOTA);
    const finDeAnio = crearEvento({ id: 'v', ...datos({ titulo: 'Receso', todoElDia: true, inicio: '2026-12-31', fin: '2027-01-01', recurrencia: null, recordatorios: [] }) }, BOGOTA, AHORA);
    const bloque = crearEvento({ id: 'b', ...datos({ titulo: 'Estudio profundo', recurrencia: null, compromiso: true, recordatorios: [] }) }, BOGOTA, AHORA);

    const r = leerIcs(escribirIcs([serie, finDeAnio, bloque], BOGOTA, AHORA), BOGOTA);
    expect(r.avisos).toEqual([]);
    const [s, v, b] = r.eventos;
    expect(s).toEqual({
      uid: 's@ludus',
      datos: { ...datos({}), inicio: '2026-11-17T01:00:00.000Z', fin: '2026-11-17T03:00:00.000Z' },
      excepciones: serie.excepciones,
    });
    expect(v!.datos).toMatchObject({ todoElDia: true, inicio: '2026-12-31', fin: '2027-01-01', titulo: 'Receso' });
    expect(b!.datos.compromiso).toBe(true);
  });
});
