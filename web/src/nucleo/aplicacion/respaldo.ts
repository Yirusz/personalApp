/**
 * Exportar / importar todos los datos como JSON (ADR-0002).
 * Importar reemplaza el contenido completo del dispositivo en una sola
 * transacción: si algo falla, los datos anteriores quedan intactos.
 */
import type { Reloj } from '../dominio/reloj';
import type { MotorDeRespaldo } from './puertos';

export const FORMATO = 'ludus-respaldo';
export const VERSION_DE_FORMATO = 1;

export interface Respaldo {
  formato: typeof FORMATO;
  versionDeFormato: number;
  versionDeApp: string;
  exportadoEn: string;
  esquemas: Record<string, number>;
  almacenes: Record<string, unknown[]>;
}

export class RespaldoInvalido extends Error {
  override name = 'RespaldoInvalido';
}

export async function crearRespaldo(motor: MotorDeRespaldo, reloj: Reloj, versionDeApp: string): Promise<Respaldo> {
  const [esquemas, almacenes] = await Promise.all([motor.versionesDeEsquema(), motor.exportarTodo()]);
  return {
    formato: FORMATO,
    versionDeFormato: VERSION_DE_FORMATO,
    versionDeApp,
    exportadoEn: reloj.ahora().toISOString(),
    esquemas,
    almacenes,
  };
}

export function nombreDeArchivo(respaldo: Pick<Respaldo, 'exportadoEn'>): string {
  // Sin ":" (prohibido en nombres de archivo de Windows).
  return `ludus-respaldo-${respaldo.exportadoEn.slice(0, 19).replace(/:/g, '-')}.json`;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valida estructura y compatibilidad; lanza `RespaldoInvalido` con un mensaje para el usuario. */
export function leerRespaldo(texto: string, esquemasActuales: Record<string, number>, almacenesActuales: readonly string[]): Respaldo {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new RespaldoInvalido('El archivo no es un JSON válido.');
  }
  if (!esObjeto(datos) || datos.formato !== FORMATO) throw new RespaldoInvalido('El archivo no es un respaldo de Ludus.');
  if (datos.versionDeFormato !== VERSION_DE_FORMATO) {
    throw new RespaldoInvalido(`Formato de respaldo ${String(datos.versionDeFormato)} no soportado (se espera ${VERSION_DE_FORMATO}).`);
  }
  if (!esObjeto(datos.esquemas) || !esObjeto(datos.almacenes) || typeof datos.exportadoEn !== 'string') {
    throw new RespaldoInvalido('El respaldo está incompleto o dañado.');
  }
  const delRespaldo = datos.esquemas;
  const diferencias = Object.keys({ ...esquemasActuales, ...delRespaldo })
    .filter((m) => esquemasActuales[m] !== delRespaldo[m])
    .map((m) => `${m}: respaldo ${String(delRespaldo[m] ?? '—')} / app ${String(esquemasActuales[m] ?? '—')}`);
  if (diferencias.length > 0) {
    throw new RespaldoInvalido(
      `El respaldo es de otra versión del esquema de datos (${diferencias.join('; ')}). En v1 solo se importan respaldos de la misma versión.`,
    );
  }
  for (const [nombre, valores] of Object.entries(datos.almacenes)) {
    if (!almacenesActuales.includes(nombre)) throw new RespaldoInvalido(`El respaldo trae un almacén desconocido: ${nombre}.`);
    if (!Array.isArray(valores) || !valores.every(esObjeto)) throw new RespaldoInvalido(`Datos dañados en "${nombre}".`);
  }
  return datos as unknown as Respaldo;
}

export async function restaurarRespaldo(motor: MotorDeRespaldo, respaldo: Respaldo): Promise<void> {
  await motor.reemplazarTodo(respaldo.almacenes);
}
