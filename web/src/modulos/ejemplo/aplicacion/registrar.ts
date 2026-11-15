import type { ContextoDeModulo, TransaccionDeLectura } from '../../../nucleo/contrato';
import { crearRegistro, type Registro } from '../dominio/registro';

export const ALMACEN = 'registros';
export const EVENTO_REGISTRO_CREADO = 'ejemplo.RegistroCreado';

/** Caso de uso: guarda el registro y publica el evento en la misma transacción. */
export async function registrar(ctx: Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'nuevoId'>, texto: string): Promise<Registro> {
  const registro = crearRegistro(ctx.nuevoId(), texto, ctx.reloj.ahora());
  await ctx.almacen.escribir([ALMACEN], async (tx) => {
    await tx.poner(ALMACEN, registro);
    tx.publicar(EVENTO_REGISTRO_CREADO, { registroId: registro.id, longitud: registro.texto.length });
  });
  return registro;
}

/** Consulta: los más recientes primero. */
export function leerRecientes(tx: TransaccionDeLectura, limite = 20): Promise<Registro[]> {
  return tx.listar<Registro>(ALMACEN, { indice: 'por_creacion', inverso: true, limite });
}
