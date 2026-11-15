/**
 * Recurrencia: subconjunto de RRULE (RFC 5545): FREQ=DAILY|WEEKLY|MONTHLY,
 * INTERVAL, BYDAY (solo semanal, sin ordinales), UNTIL (fecha local inclusiva)
 * y COUNT. Las fechas excluidas viven en el evento (excepciones).
 *
 * Las ocurrencias se calculan solo para un rango; nunca se materializan todas.
 */
import { diaSemana, diferenciaDias, DIAS_SEMANA, fechaConDia, componentes, sumarDias, sumarMeses, type DiaSemana } from './fechas';
import { esFechaCivil } from '../../../nucleo/dominio/zona-horaria';
import { RecurrenciaInvalida } from './errores';

export const FRECUENCIAS = ['diaria', 'semanal', 'mensual'] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];
export const INTERVALO_MAX = 99;
export const CONTEO_MAX = 999;

export type FinDeRecurrencia = { tipo: 'nunca' } | { tipo: 'fecha'; hasta: string } | { tipo: 'conteo'; veces: number };

export interface Recurrencia {
  frecuencia: Frecuencia;
  intervalo: number;
  /** Días de la semana (solo semanal; vacío en las demás). */
  dias: DiaSemana[];
  fin: FinDeRecurrencia;
}

export function validarRecurrencia(r: Recurrencia): Recurrencia {
  if (!FRECUENCIAS.includes(r.frecuencia)) throw new RecurrenciaInvalida(`Frecuencia no soportada: ${String(r.frecuencia)}`);
  if (!Number.isInteger(r.intervalo) || r.intervalo < 1 || r.intervalo > INTERVALO_MAX) throw new RecurrenciaInvalida('Intervalo fuera de 1–99');
  const dias = r.frecuencia === 'semanal' ? [...new Set(r.dias)].sort((a, b) => a - b) : [];
  if (r.frecuencia === 'semanal' && (dias.length === 0 || dias.some((d) => !DIAS_SEMANA.includes(d)))) {
    throw new RecurrenciaInvalida('Elige al menos un día de la semana');
  }
  let fin: FinDeRecurrencia;
  if (r.fin.tipo === 'nunca') fin = { tipo: 'nunca' };
  else if (r.fin.tipo === 'fecha') {
    if (!esFechaCivil(r.fin.hasta)) throw new RecurrenciaInvalida('Fecha de fin inválida');
    fin = { tipo: 'fecha', hasta: r.fin.hasta };
  } else if (r.fin.tipo === 'conteo') {
    if (!Number.isInteger(r.fin.veces) || r.fin.veces < 1 || r.fin.veces > CONTEO_MAX) throw new RecurrenciaInvalida('Repeticiones fuera de 1–999');
    fin = { tipo: 'conteo', veces: r.fin.veces };
  } else throw new RecurrenciaInvalida('Fin de recurrencia desconocido');
  return { frecuencia: r.frecuencia, intervalo: r.intervalo, dias, fin };
}

/** Primera fecha de la serie: si el día de inicio no está entre los elegidos, el siguiente que sí. */
export function primeraFecha(inicio: string, r: Recurrencia): string {
  if (r.frecuencia !== 'semanal') return inicio;
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(inicio, i);
    if (r.dias.includes(diaSemana(f))) return f;
  }
  return inicio;
}

const LIMITE_DE_PASOS = 200_000;

/**
 * Fechas de ocurrencia de la serie dentro de [desde, hasta] (inclusivo).
 * `inicio` es la primera ocurrencia. Con COUNT se recorre desde el inicio (máx. 999);
 * sin COUNT se salta directamente cerca de `desde`.
 */
export function fechasDeOcurrencia(inicio: string, r: Recurrencia, desde: string, hasta: string): string[] {
  const tope = r.fin.tipo === 'fecha' && r.fin.hasta < hasta ? r.fin.hasta : hasta;
  const conConteo = r.fin.tipo === 'conteo' ? r.fin.veces : Infinity;
  const saltar = conConteo === Infinity;
  const resultado: string[] = [];
  let contadas = 0;
  let pasos = 0;
  const visitar = (f: string): boolean => {
    // Devuelve false cuando hay que detenerse.
    if (f > tope || contadas >= conConteo) return false;
    contadas++;
    if (f >= desde) resultado.push(f);
    return true;
  };

  if (tope < inicio) return [];

  if (r.frecuencia === 'diaria') {
    let k = saltar ? Math.max(0, Math.ceil(diferenciaDias(inicio, desde) / r.intervalo)) : 0;
    while (pasos++ < LIMITE_DE_PASOS && visitar(sumarDias(inicio, k * r.intervalo))) k++;
  } else if (r.frecuencia === 'semanal') {
    const semana0 = sumarDias(inicio, 1 - diaSemana(inicio));
    let w = 0;
    if (saltar) {
      const semanas = Math.max(0, Math.floor(diferenciaDias(semana0, desde) / 7));
      w = semanas - (semanas % r.intervalo);
    }
    for (; pasos++ < LIMITE_DE_PASOS; w += r.intervalo) {
      const lunes = sumarDias(semana0, w * 7);
      if (lunes > tope) break;
      let seguir = true;
      for (const d of r.dias) {
        const f = sumarDias(lunes, d - 1);
        if (f < inicio) continue;
        if (!visitar(f)) {
          seguir = false;
          break;
        }
      }
      if (!seguir) break;
    }
  } else {
    const { anio, mes, dia } = componentes(inicio);
    let m = 0;
    if (saltar) {
      const d = componentes(desde);
      const meses = Math.max(0, (d.anio - anio) * 12 + (d.mes - mes));
      m = meses - (meses % r.intervalo);
    }
    for (; pasos++ < LIMITE_DE_PASOS; m += r.intervalo) {
      const { anio: a, mes: me } = sumarMeses(anio, mes, m);
      if (`${a}-${String(me).padStart(2, '0')}-01` > tope) break;
      const f = fechaConDia(a, me, dia);
      if (f === null) continue; // el mes no tiene ese día: no cuenta (RFC 5545)
      if (!visitar(f)) break;
    }
  }
  return resultado;
}

/** ¿`fecha` es una ocurrencia de la serie? */
export function esOcurrencia(inicio: string, r: Recurrencia, fecha: string): boolean {
  return fechasDeOcurrencia(inicio, r, fecha, fecha).length === 1;
}
