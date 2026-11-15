import type { Reloj } from './reloj';

/** Puerto de aleatoriedad (en producción: `crypto.getRandomValues`). */
export interface FuenteAleatoria {
  llenar(bytes: Uint8Array<ArrayBuffer>): void;
}

const PATRON_UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_CONTADOR = 0xfff; // 12 bits de rand_a usados como contador (RFC 9562 §6.2, método 1)

export function esUuidV7(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_UUID_V7.test(valor);
}

/** Milisegundos Unix codificados en un UUIDv7. */
export function marcaDeTiempoDe(uuid: string): number {
  if (!esUuidV7(uuid)) throw new TypeError(`No es un UUIDv7: ${uuid}`);
  return parseInt(uuid.slice(0, 8) + uuid.slice(9, 13), 16);
}

function contadorDe(uuid: string): number {
  return parseInt(uuid.slice(15, 18), 16);
}

const hex = (n: number, digitos: number) => n.toString(16).padStart(digitos, '0');

/**
 * Generador de UUIDv7 (RFC 9562) **monótono**: cada id es estrictamente mayor
 * (como texto) que el anterior, aunque el reloj retroceda o se generen muchos
 * en el mismo milisegundo. El orden importa: el bus de eventos usa los ids
 * como cursor (ADR-0009).
 */
export class GeneradorUuidV7 {
  private ultimoMs = -1;
  private contador = 0;

  constructor(
    private readonly reloj: Reloj,
    private readonly aleatorio: FuenteAleatoria,
  ) {}

  siguiente(): string {
    const ahora = this.reloj.ahora().getTime();
    if (ahora > this.ultimoMs) {
      this.ultimoMs = ahora;
      // Arranque aleatorio en la mitad baja: deja margen para incrementar.
      const semilla = new Uint8Array(2);
      this.aleatorio.llenar(semilla);
      this.contador = ((semilla[0]! << 8) | semilla[1]!) & 0x7ff;
    } else {
      // Mismo milisegundo o reloj hacia atrás: seguimos la secuencia.
      this.contador++;
      if (this.contador > MAX_CONTADOR) {
        this.ultimoMs++; // "tomar prestado" el siguiente milisegundo
        this.contador = 0;
      }
    }

    const resto = new Uint8Array(8);
    this.aleatorio.llenar(resto);
    resto[0] = (resto[0]! & 0x3f) | 0x80; // variante 10xx

    const ms = this.ultimoMs;
    const alto = Math.floor(ms / 0x10000); // 32 bits superiores
    const bajo = ms % 0x10000; // 16 bits inferiores
    const rb = Array.from(resto, (b) => hex(b, 2)).join('');
    return `${hex(alto, 8)}-${hex(bajo, 4)}-7${hex(this.contador, 3)}-${rb.slice(0, 4)}-${rb.slice(4)}`;
  }

  /**
   * Garantiza que los próximos ids sean mayores que `uuid` (p. ej. el último
   * evento guardado), aunque el reloj del dispositivo haya retrocedido entre
   * sesiones.
   */
  asegurarPosteriorA(uuid: string): void {
    const ms = marcaDeTiempoDe(uuid);
    const contador = contadorDe(uuid);
    if (ms > this.ultimoMs || (ms === this.ultimoMs && contador > this.contador)) {
      this.ultimoMs = ms;
      this.contador = contador;
    }
  }
}
