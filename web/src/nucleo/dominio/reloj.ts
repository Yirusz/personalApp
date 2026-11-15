/**
 * Puerto de tiempo. El dominio nunca llama a `Date.now()`: recibe un Reloj.
 * Así las pruebas son deterministas y la hora del dispositivo se trata como
 * una dependencia más (puede estar desfasada; guía §10).
 */
export interface Reloj {
  ahora(): Date;
}

/** Reloj controlable para pruebas. */
export class RelojFijo implements Reloj {
  private ms: number;

  constructor(instante: Date | string) {
    this.ms = new Date(instante).getTime();
    if (Number.isNaN(this.ms)) throw new RangeError(`Instante inválido: ${String(instante)}`);
  }

  ahora(): Date {
    return new Date(this.ms);
  }

  avanzar(milisegundos: number): void {
    this.ms += milisegundos;
  }

  fijar(instante: Date | string): void {
    this.ms = new Date(instante).getTime();
  }
}
