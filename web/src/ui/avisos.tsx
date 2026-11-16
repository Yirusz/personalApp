/**
 * Avisos breves del shell (R5): "¡Nivel 3!", "3 logros: …". Uno a la vez, en cola.
 * Se cierran solos en 5 s, con Escape o con ✕. La región es aria-live (polite) y
 * existe siempre, para que el lector de pantalla anuncie lo que entra.
 * Sin animación si el sistema pide reducir el movimiento (CSS).
 */
import { useEffect } from 'preact/hooks';
import type { Avisador, AvisoDelShell } from '../nucleo/contrato';
import { crearSenal, useSenal } from './senal';
import { useServicios } from './servicios';

export const DURACION_AVISO_MS = 5000;

const cola = crearSenal<readonly AvisoDelShell[]>([]);

export const avisadorDelShell: Avisador = {
  mostrar: (aviso) => cola.fijar([...cola.valor(), aviso]),
};

const cerrarActual = () => cola.fijar(cola.valor().slice(1));

export function BarraDeAvisos() {
  const avisos = useSenal(cola);
  const { t } = useServicios();
  const actual = avisos[0];
  useEffect(() => {
    if (!actual) return;
    const id = setTimeout(cerrarActual, DURACION_AVISO_MS);
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && cerrarActual();
    addEventListener('keydown', alTeclear);
    return () => {
      clearTimeout(id);
      removeEventListener('keydown', alTeclear);
    };
  }, [actual]);
  return (
    <div class="avisos-shell" role="status" aria-live="polite" aria-atomic="true">
      {actual && (
        <div class="aviso-shell">
          {actual.icono && (
            <span class="aviso-shell__icono" aria-hidden="true">
              {actual.icono}
            </span>
          )}
          <div class="aviso-shell__texto">
            <strong>{actual.titulo}</strong>
            {actual.detalle && <span>{actual.detalle}</span>}
          </div>
          <button type="button" class="boton aviso-shell__cerrar" aria-label={t('app.cerrarAviso')} onClick={cerrarActual}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
