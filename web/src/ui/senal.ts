import { useEffect, useState } from 'preact/hooks';

/** Valor observable mínimo (evita una dependencia para estado global del shell). */
export interface Senal<T> {
  valor(): T;
  fijar(valor: T): void;
  suscribir(fn: (valor: T) => void): () => void;
}

export function crearSenal<T>(inicial: T): Senal<T> {
  let actual = inicial;
  const escuchas = new Set<(valor: T) => void>();
  return {
    valor: () => actual,
    fijar: (valor) => {
      actual = valor;
      for (const fn of escuchas) fn(valor);
    },
    suscribir: (fn) => {
      escuchas.add(fn);
      return () => escuchas.delete(fn);
    },
  };
}

export function useSenal<T>(senal: Senal<T>): T {
  const [valor, setValor] = useState(senal.valor);
  useEffect(() => {
    setValor(() => senal.valor());
    return senal.suscribir((v) => setValor(() => v));
  }, [senal]);
  return valor;
}
