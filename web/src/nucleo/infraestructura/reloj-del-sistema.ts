import type { Reloj } from '../dominio/reloj';
import type { FuenteAleatoria } from '../dominio/uuidv7';

export const relojDelSistema: Reloj = { ahora: () => new Date(Date.now()) };

export const aleatorioCriptografico: FuenteAleatoria = {
  llenar: (bytes) => {
    crypto.getRandomValues(bytes);
  },
};
