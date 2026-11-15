/**
 * Registro local de diagnóstico (guía §13): sin telemetría externa.
 * Mantiene las últimas entradas en memoria y, si se le da un destino, las
 * guarda también en `nucleo_diagnostico` para verlas tras recargar.
 */
import type { AlmacenDeModulo, Diagnostico } from '../contrato';
import type { Reloj } from '../dominio/reloj';

export interface EntradaDeDiagnostico {
  id: string;
  instante: string;
  nivel: 'error' | 'aviso' | 'info';
  origen: string;
  mensaje: string;
  detalle?: string;
}

export interface DestinoDeDiagnostico {
  guardar(entrada: EntradaDeDiagnostico, maximo: number): Promise<void>;
  cargar(maximo: number): Promise<EntradaDeDiagnostico[]>;
}

function describir(detalle: unknown): string | undefined {
  if (detalle === undefined) return undefined;
  if (detalle instanceof Error) return `${detalle.name}: ${detalle.message}${detalle.stack ? `\n${detalle.stack}` : ''}`;
  try {
    return JSON.stringify(detalle, (_k, v: unknown) => (v instanceof Error ? `${v.name}: ${v.message}` : v), 2);
  } catch {
    return String(detalle);
  }
}

export class RegistroDeDiagnostico implements Diagnostico {
  private entradas: EntradaDeDiagnostico[] = [];
  private readonly escuchas = new Set<() => void>();
  private destino?: DestinoDeDiagnostico;

  constructor(
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
    private readonly maximo = 200,
  ) {}

  /** Conecta la persistencia (cuando la base ya está abierta) y recupera lo guardado. */
  async conectar(destino: DestinoDeDiagnostico): Promise<void> {
    this.destino = destino;
    const previas = await destino.cargar(this.maximo);
    const ids = new Set(this.entradas.map((e) => e.id));
    this.entradas = [...previas.filter((e) => !ids.has(e.id)), ...this.entradas].slice(-this.maximo);
    for (const e of this.entradas.filter((e) => ids.has(e.id))) void this.persistir(e);
    this.avisar();
  }

  registrar(nivel: EntradaDeDiagnostico['nivel'], origen: string, mensaje: string, detalle?: unknown): void {
    const entrada: EntradaDeDiagnostico = {
      id: this.nuevoId(),
      instante: this.reloj.ahora().toISOString(),
      nivel,
      origen,
      mensaje,
      detalle: describir(detalle),
    };
    this.entradas.push(entrada);
    if (this.entradas.length > this.maximo) this.entradas.shift();
    if (nivel === 'error') console.error(`[${origen}] ${mensaje}`, detalle ?? '');
    void this.persistir(entrada);
    this.avisar();
  }

  todas(): readonly EntradaDeDiagnostico[] {
    return this.entradas;
  }

  alCambiar(fn: () => void): () => void {
    this.escuchas.add(fn);
    return () => this.escuchas.delete(fn);
  }

  /** Captura errores no manejados de la página. */
  capturarErroresGlobales(objetivo: Pick<Window, 'addEventListener'>): void {
    objetivo.addEventListener('error', (e) => {
      const ev = e as ErrorEvent;
      this.registrar('error', 'ventana', ev.message || 'Error no manejado', ev.error);
    });
    objetivo.addEventListener('unhandledrejection', (e) => {
      this.registrar('error', 'promesa', 'Promesa rechazada sin manejar', (e as PromiseRejectionEvent).reason);
    });
  }

  private async persistir(entrada: EntradaDeDiagnostico): Promise<void> {
    if (!this.destino) return;
    try {
      await this.destino.guardar(entrada, this.maximo);
    } catch (error) {
      // No registrar aquí: crearía un ciclo. La entrada sigue en memoria.
      console.warn('No se pudo guardar el diagnóstico', error);
    }
  }

  private avisar(): void {
    for (const fn of this.escuchas) fn();
  }
}

/** Persistencia del diagnóstico en `nucleo_diagnostico`, conservando las últimas `maximo` entradas. */
export function destinoEnAlmacen(nucleo: AlmacenDeModulo): DestinoDeDiagnostico {
  return {
    guardar: (entrada, maximo) =>
      nucleo.escribir(['diagnostico'], async (tx) => {
        await tx.poner('diagnostico', entrada);
        const total = await tx.contar('diagnostico');
        if (total <= maximo) return;
        const sobrantes = await tx.listar<EntradaDeDiagnostico>('diagnostico', { limite: total - maximo });
        for (const vieja of sobrantes) await tx.borrar('diagnostico', vieja.id);
      }),
    cargar: async (maximo) =>
      (await nucleo.leer(['diagnostico'], (tx) => tx.listar<EntradaDeDiagnostico>('diagnostico', { inverso: true, limite: maximo }))).reverse(),
  };
}
