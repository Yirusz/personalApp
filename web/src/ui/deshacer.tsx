/**
 * "Deshacer" genérico del shell (guía §15: preferir deshacer a pedir confirmación).
 *
 * Un módulo ofrece deshacer una acción durante 10 s. Dos estilos:
 * - Acción ya hecha + compensación: `deshacer` revierte (p. ej. archivar → restaurar).
 * - Acción diferida: `confirmar` la ejecuta al vencer el plazo y `ocultar` indica
 *   qué id esconder mientras tanto (p. ej. eliminar un entregable).
 *
 * El estado vive fuera de los componentes: sobrevive a cambios de pantalla.
 * Si la app pasa a segundo plano, lo pendiente se confirma de inmediato (Android
 * puede cerrar la pestaña sin aviso). Si se cierra antes, la acción diferida no
 * ocurre: el fallo es seguro (no se pierde nada).
 */
import { useEffect } from 'preact/hooks';
import { crearSenal, useSenal } from './senal';
import { useServicios } from './servicios';

export const DURACION_DESHACER_MS = 10_000;

export interface OfertaDeDeshacer {
  /** Texto ya traducido, p. ej. "Materia archivada". */
  mensaje: string;
  /** Revierte la acción (o simplemente cancela la acción diferida). */
  deshacer?: () => void | Promise<void>;
  /** Ejecuta la acción diferida al vencer el plazo, al ofrecer otra o al ocultarse la app. */
  confirmar?: () => Promise<void>;
  /** Id de la entidad que la UI debe esconder mientras la oferta está vigente. */
  ocultar?: string;
}

interface Vigente extends OfertaDeDeshacer {
  numero: number;
}

const vigente = crearSenal<Vigente | null>(null);
const fallo = crearSenal<unknown>(null);
let contador = 0;
let temporizador: ReturnType<typeof setTimeout> | undefined;
let escuchando = false;

function escucharSegundoPlano(): void {
  if (escuchando || typeof document === 'undefined') return;
  escuchando = true;
  const alOcultar = () => {
    if (document.visibilityState === 'hidden') void confirmarVigente();
  };
  document.addEventListener('visibilitychange', alOcultar);
  addEventListener('pagehide', () => void confirmarVigente());
}

async function ejecutar(fn: (() => void | Promise<void>) | undefined): Promise<void> {
  try {
    await fn?.();
  } catch (error) {
    fallo.fijar(error);
  }
}

/** Ejecuta ya la acción pendiente (si la hay) y cierra la barra. */
export async function confirmarVigente(): Promise<void> {
  const oferta = vigente.valor();
  if (!oferta) return;
  clearTimeout(temporizador);
  vigente.fijar(null);
  await ejecutar(oferta.confirmar);
}

/** Revierte la acción vigente y cierra la barra. */
export async function deshacerVigente(): Promise<void> {
  const oferta = vigente.valor();
  if (!oferta) return;
  clearTimeout(temporizador);
  vigente.fijar(null);
  await ejecutar(oferta.deshacer);
}

/** Muestra la barra "Deshacer". Una oferta anterior todavía vigente se confirma primero. */
export async function ofrecerDeshacer(oferta: OfertaDeDeshacer): Promise<void> {
  escucharSegundoPlano();
  await confirmarVigente();
  fallo.fijar(null);
  const numero = ++contador;
  vigente.fijar({ ...oferta, numero });
  temporizador = setTimeout(() => {
    if (vigente.valor()?.numero === numero) void confirmarVigente();
  }, DURACION_DESHACER_MS);
}

/** Id que la UI debe esconder ahora mismo (acción diferida en curso), o `null`. */
export function useOcultoPorDeshacer(): string | null {
  return useSenal(vigente)?.ocultar ?? null;
}

/** Se monta una sola vez en el shell. Ctrl+Z (fuera de un campo de texto) también deshace. */
export function BarraDeshacer() {
  const s = useServicios();
  const oferta = useSenal(vigente);
  const error = useSenal(fallo);

  useEffect(() => {
    if (error) s.diagnostico.registrar('error', 'deshacer', error instanceof Error ? error.message : String(error), error);
  }, [error]);

  useEffect(() => {
    if (!oferta) return;
    const alTeclear = (e: KeyboardEvent) => {
      const enCampo = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !enCampo) {
        e.preventDefault();
        void deshacerVigente();
      }
    };
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, [oferta]);

  if (error) {
    return (
      <div class="barra-deshacer" role="alert">
        <span>{s.t('app.deshacerFallo')}</span>
        <button type="button" class="boton" onClick={() => fallo.fijar(null)}>
          {s.t('app.cerrar')}
        </button>
      </div>
    );
  }
  return (
    <div class={oferta ? 'barra-deshacer' : 'oculto-visualmente'} role="status" aria-live="polite">
      {oferta && (
        <>
          <span>{oferta.mensaje}</span>
          <span class="acciones">
            <button type="button" class="boton boton--primario" onClick={() => void deshacerVigente()} aria-keyshortcuts="Control+Z">
              {s.t('app.deshacer')}
            </button>
            <button type="button" class="boton" onClick={() => void confirmarVigente()} aria-label={s.t('app.cerrar')}>
              ✕
            </button>
          </span>
        </>
      )}
    </div>
  );
}
