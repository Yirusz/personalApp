/**
 * Bus de eventos en proceso con entrega confiable (ADR-0009).
 *
 * Los eventos ya están guardados en `nucleo_eventos` (bandeja de salida) por la
 * misma transacción que cambió el estado del módulo que los publicó. El bus los
 * entrega a cada suscripción en orden de id (UUIDv7) y guarda su avance en
 * `nucleo_cursores` DENTRO de la misma transacción en la que la suscripción
 * escribe su propio estado. Resultado:
 * - Si la app se cierra a mitad de camino, al abrir se retoma donde quedó.
 * - Cada suscripción procesa cada evento exactamente una vez.
 * - Si una suscripción falla, su transacción se deshace, queda bloqueada (visible
 *   en Diagnóstico) y las demás siguen funcionando.
 */
import type { Diagnostico, Suscripcion } from '../contrato';
import type { EventoDeDominio } from '../dominio/evento';
import { PATRON_TIPO_EVENTO } from '../dominio/evento';
import type { MotorDeAlmacen } from './puertos';

interface Cursor {
  suscripcion: string;
  ultimoEventoId: string;
  actualizadoEn: string;
}

interface Registrada {
  moduloId: string;
  suscripcion: Suscripcion;
}

export interface EstadoDeSuscripcion {
  id: string;
  moduloId: string;
  ultimoEventoId?: string;
  bloqueo?: { eventoId?: string; mensaje: string };
}

export class ErrorDeBus extends Error {
  override name = 'ErrorDeBus';
}

const MAX_VUELTAS = 1000;

export class BusDeEventos {
  private readonly registradas = new Map<string, Registrada>();
  private readonly bloqueos = new Map<string, { eventoId?: string; mensaje: string }>();
  private enCurso: Promise<void> | null = null;
  private repetir = false;

  constructor(
    private readonly motor: MotorDeAlmacen,
    private readonly diagnostico: Diagnostico,
    private readonly reloj: { ahora(): Date },
    private readonly tamanoDeLote = 50,
  ) {
    motor.alPublicar(() => this.programar());
  }

  registrar(moduloId: string, suscripcion: Suscripcion): void {
    if (this.registradas.has(suscripcion.id)) throw new ErrorDeBus(`Suscripción duplicada: ${suscripcion.id}`);
    if (suscripcion.tipos !== '*') {
      for (const tipo of suscripcion.tipos) {
        if (!PATRON_TIPO_EVENTO.test(tipo)) throw new ErrorDeBus(`Tipo de evento inválido en ${suscripcion.id}: ${tipo}`);
      }
    }
    this.registradas.set(suscripcion.id, { moduloId, suscripcion });
  }

  /** Inicializa cursores de las suscripciones `desdeAhora` y procesa lo pendiente. */
  async iniciar(): Promise<void> {
    for (const [id, { suscripcion }] of this.registradas) {
      if (suscripcion.historial !== 'desdeAhora') continue;
      await this.motor.ejecutar(
        'nucleo',
        [],
        'readwrite',
        async (_tx, nucleo) => {
          if (await nucleo.obtener<Cursor>('cursores', id)) return;
          const [ultimo] = await nucleo.listar<EventoDeDominio>('eventos', { inverso: true, limite: 1 });
          if (ultimo) await nucleo.poner<Cursor>('cursores', this.cursor(id, ultimo.id));
        },
        ['cursores', 'eventos'],
      );
    }
    await this.procesarPendientes();
  }

  /** Dispara el procesamiento sin esperar (los errores van a Diagnóstico). */
  programar(): void {
    this.procesarPendientes().catch((error: unknown) =>
      this.diagnostico.registrar('error', 'bus', 'Fallo inesperado al procesar eventos', error),
    );
  }

  /** Entrega todos los eventos pendientes. Llamadas concurrentes se combinan en una sola pasada extra. */
  procesarPendientes(): Promise<void> {
    if (this.enCurso) {
      this.repetir = true;
      return this.enCurso;
    }
    this.enCurso = (async () => {
      try {
        do {
          this.repetir = false;
          let vueltas = 0;
          let huboProgreso: boolean;
          do {
            huboProgreso = false;
            for (const [id, registrada] of this.registradas) {
              if (this.bloqueos.has(id)) continue;
              if ((await this.procesarLote(id, registrada)) > 0) huboProgreso = true;
            }
            if (++vueltas >= MAX_VUELTAS) {
              this.diagnostico.registrar('aviso', 'bus', 'Demasiadas vueltas seguidas: ¿eventos que se generan en ciclo?');
              break;
            }
          } while (huboProgreso);
        } while (this.repetir);
      } finally {
        this.enCurso = null;
      }
    })();
    return this.enCurso;
  }

  private cursor(id: string, ultimoEventoId: string): Cursor {
    return { suscripcion: id, ultimoEventoId, actualizadoEn: this.reloj.ahora().toISOString() };
  }

  private async procesarLote(id: string, { moduloId, suscripcion }: Registrada): Promise<number> {
    let eventoActual: string | undefined;
    try {
      return await this.motor.ejecutar(
        moduloId,
        suscripcion.almacenes,
        'readwrite',
        async (tx, nucleo) => {
          const cursor = await nucleo.obtener<Cursor>('cursores', id);
          const eventos = await nucleo.listar<EventoDeDominio>('eventos', {
            desde: cursor?.ultimoEventoId,
            excluirDesde: true,
            limite: this.tamanoDeLote,
          });
          if (eventos.length === 0) return 0;
          for (const evento of eventos) {
            if (suscripcion.tipos === '*' || suscripcion.tipos.includes(evento.tipo)) {
              eventoActual = evento.id;
              await suscripcion.manejar(evento, tx);
            }
          }
          await nucleo.poner<Cursor>('cursores', this.cursor(id, eventos[eventos.length - 1]!.id));
          return eventos.length;
        },
        ['cursores', 'eventos'],
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.bloqueos.set(id, { eventoId: eventoActual, mensaje });
      this.diagnostico.registrar('error', `bus:${id}`, `La suscripción quedó en pausa: ${mensaje}`, {
        eventoId: eventoActual,
        error,
      });
      return 0;
    }
  }

  async estado(): Promise<EstadoDeSuscripcion[]> {
    const cursores = await this.motor.ejecutar(
      'nucleo',
      [],
      'readonly',
      (_tx, nucleo) => nucleo.listar<Cursor>('cursores'),
      ['cursores'],
    );
    const porId = new Map(cursores.map((c) => [c.suscripcion, c.ultimoEventoId]));
    return [...this.registradas].map(([id, r]) => ({
      id,
      moduloId: r.moduloId,
      ultimoEventoId: porId.get(id),
      bloqueo: this.bloqueos.get(id),
    }));
  }

  /** Quita la pausa (de una o de todas) y reintenta. */
  desbloquear(id?: string): Promise<void> {
    if (id) this.bloqueos.delete(id);
    else this.bloqueos.clear();
    return this.procesarPendientes();
  }
}
