/** Componentes base del shell, reutilizables por los módulos. Solo usan tokens de estilo (ADR-0007). */
import type { ComponentChildren, ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useServicios } from './servicios';

export function Icono({ d, titulo }: { d: string; titulo?: string }) {
  return (
    <svg class="icono" viewBox="0 0 24 24" aria-hidden={titulo ? undefined : 'true'} role={titulo ? 'img' : undefined}>
      {titulo && <title>{titulo}</title>}
      <path d={d} />
    </svg>
  );
}

export function Cargando() {
  const { t } = useServicios();
  return (
    <p class="estado estado--cargando" role="status" aria-live="polite">
      {t('app.cargando')}
    </p>
  );
}

export function Vacio({ children }: { children: ComponentChildren }) {
  return <p class="estado estado--vacio">{children}</p>;
}

export function ErrorConReintento({ error, reintentar }: { error: unknown; reintentar: () => void }) {
  const { t } = useServicios();
  const detalle = error instanceof Error ? error.message : String(error);
  return (
    <div class="estado estado--error" role="alert">
      <p>{t('app.errorGenerico')}</p>
      <p class="texto-tenue">{detalle}</p>
      <button type="button" class="boton" onClick={reintentar}>
        {t('app.reintentar')}
      </button>
    </div>
  );
}

const cacheDeVistas = new Map<() => Promise<ComponentType<never>>, ComponentType<never>>();

/** Carga diferida de una pantalla (trozo de JS aparte) con estados de carga y error. */
export function VistaDiferida<P extends object>({ cargar, props }: { cargar: () => Promise<ComponentType<P>>; props: P }) {
  const [Componente, setComponente] = useState<ComponentType<P> | null>(
    () => (cacheDeVistas.get(cargar as never) as ComponentType<P> | undefined) ?? null,
  );
  const [error, setError] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (cacheDeVistas.has(cargar as never)) {
      setComponente(() => cacheDeVistas.get(cargar as never) as ComponentType<P>);
      return;
    }
    let vigente = true;
    setComponente(null);
    setError(null);
    cargar()
      .then((c) => {
        cacheDeVistas.set(cargar as never, c as ComponentType<never>);
        if (vigente) setComponente(() => c);
      })
      .catch((e: unknown) => vigente && setError(e));
    return () => {
      vigente = false;
    };
  }, [cargar, intento]);

  if (error) return <ErrorConReintento error={error} reintentar={() => setIntento((i) => i + 1)} />;
  if (!Componente) return <Cargando />;
  return <Componente {...props} />;
}

export function Seccion({ titulo, children }: { titulo: string; children: ComponentChildren }) {
  return (
    <section class="seccion">
      <h2 class="seccion__titulo">{titulo}</h2>
      {children}
    </section>
  );
}
