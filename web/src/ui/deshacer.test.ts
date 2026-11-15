import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmarVigente, deshacerVigente, DURACION_DESHACER_MS, ofrecerDeshacer } from './deshacer';

describe('deshacer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(async () => {
    await confirmarVigente();
    vi.useRealTimers();
  });

  it('confirma la acción diferida al vencer el plazo de 10 s', async () => {
    const confirmar = vi.fn(async () => undefined);
    await ofrecerDeshacer({ mensaje: 'x', confirmar });
    await vi.advanceTimersByTimeAsync(DURACION_DESHACER_MS - 1);
    expect(confirmar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(confirmar).toHaveBeenCalledOnce();
  });

  it('deshacer cancela la acción diferida y ejecuta la compensación', async () => {
    const confirmar = vi.fn(async () => undefined);
    const deshacer = vi.fn();
    await ofrecerDeshacer({ mensaje: 'x', confirmar, deshacer });
    await deshacerVigente();
    await vi.advanceTimersByTimeAsync(DURACION_DESHACER_MS * 2);
    expect(deshacer).toHaveBeenCalledOnce();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('una oferta nueva confirma la anterior una sola vez', async () => {
    const primera = vi.fn(async () => undefined);
    const segunda = vi.fn(async () => undefined);
    await ofrecerDeshacer({ mensaje: '1', confirmar: primera });
    await ofrecerDeshacer({ mensaje: '2', confirmar: segunda });
    expect(primera).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(DURACION_DESHACER_MS);
    expect(primera).toHaveBeenCalledOnce();
    expect(segunda).toHaveBeenCalledOnce();
  });
});
