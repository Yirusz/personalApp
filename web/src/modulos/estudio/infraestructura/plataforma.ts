/**
 * Capacidades del navegador para el aviso (E3), detectadas antes de usarlas:
 * - Tono con Web Audio (oscilador, 0 KB, sin archivos). El AudioContext se crea o
 *   reanuda al tocar "Iniciar": los navegadores bloquean el audio sin un gesto previo.
 * - Vibración (Android; en iOS y escritorio no existe).
 * - Mantener la pantalla encendida (Screen Wake Lock), donde exista.
 * Nada de esto lanza: si falta, simplemente no ocurre.
 */

type ConstructorDeAudio = typeof AudioContext;

let audio: AudioContext | null = null;

function constructorDeAudio(): ConstructorDeAudio | null {
  const w = globalThis as unknown as { AudioContext?: ConstructorDeAudio; webkitAudioContext?: ConstructorDeAudio };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Llamar desde un gesto del usuario (clic en "Iniciar"/"Reanudar"). */
export function prepararAudio(): void {
  try {
    const C = constructorDeAudio();
    if (!C) return;
    audio ??= new C();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

/** Tres pitidos cortos (880 Hz) con envolvente suave. Devuelve si pudo sonar. */
export function sonarTono(): boolean {
  try {
    if (!audio || audio.state !== 'running') return false;
    const inicio = audio.currentTime + 0.05;
    for (let i = 0; i < 3; i++) {
      const t = inicio + i * 0.35;
      const osc = audio.createOscillator();
      const vol = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(vol).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
    return true;
  } catch {
    return false;
  }
}

export const puedeVibrar = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrar(): void {
  try {
    if (puedeVibrar()) navigator.vibrate([200, 100, 200, 100, 400]);
  } catch {
    // Sin vibración.
  }
}

// ---- Pantalla encendida ----

interface Candado {
  release(): Promise<void>;
  addEventListener(tipo: 'release', fn: () => void): void;
}
interface ConWakeLock {
  wakeLock?: { request(tipo: 'screen'): Promise<Candado> };
}

export const puedeMantenerPantalla = () => typeof navigator !== 'undefined' && !!(navigator as ConWakeLock).wakeLock;

let candado: Candado | null = null;

export async function mantenerPantalla(): Promise<boolean> {
  if (!puedeMantenerPantalla() || candado) return candado !== null;
  try {
    candado = await (navigator as ConWakeLock).wakeLock!.request('screen');
    candado.addEventListener('release', () => (candado = null));
    return true;
  } catch {
    candado = null; // p. ej. batería baja o pestaña oculta
    return false;
  }
}

export function liberarPantalla(): void {
  const c = candado;
  candado = null;
  void c?.release().catch(() => undefined);
}
