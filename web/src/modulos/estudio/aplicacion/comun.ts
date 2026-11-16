/** Almacenes, eventos publicados y lecturas compartidas por los casos de uso de Estudio. */
import type { ContextoDeModulo, DeclaracionDeEvento, TransaccionDeLectura } from '../../../nucleo/contrato';
import { crearZona, type Zona } from '../../../nucleo/dominio/zona-horaria';
import { ZONA_HORARIA } from '../../../nucleo/i18n/traductor';
import { configuracionDesdeAlmacen, type ConfiguracionPomodoro } from '../dominio/configuracion';
import { CICLO_INICIAL, type Ciclo, type EstadoFinal, type Fase, type SesionActiva } from '../dominio/sesion';

/** Registros únicos (clave): la sesión activa, el ciclo y la configuración. */
export const ESTADO = 'estado';
/** Historial de sesiones terminadas. */
export const SESIONES = 'sesiones';
export const INDICE_POR_DIA = 'por_dia';
export const INDICE_POR_FIN = 'por_fin';

export const CLAVE_ACTIVA = 'activa';
export const CLAVE_CICLO = 'ciclo';
export const CLAVE_CONFIGURACION = 'configuracion';

export const PUBLICADOS = {
  PomodoroCompletado: 'estudio.PomodoroCompletado',
  PomodoroInterrumpido: 'estudio.PomodoroInterrumpido',
  DescansoCompletado: 'estudio.DescansoCompletado',
} as const;

export const DECLARACIONES: Readonly<Record<string, DeclaracionDeEvento>> = {
  [PUBLICADOS.PomodoroCompletado]: {
    version: 1,
    descripcion: 'Terminó un foco completo. ocurridoEn = fin real (aunque se detecte después, ADR-0016). Datos: sesionId, vinculo ({tipo, id} | null), minutosFoco, iniciadaEn.',
  },
  [PUBLICADOS.PomodoroInterrumpido]: { version: 1, descripcion: 'Se detuvo un foco antes de tiempo (sin XP). Datos: sesionId, vinculo, minutosFoco (hechos).' },
  [PUBLICADOS.DescansoCompletado]: { version: 1, descripcion: 'Terminó un descanso completo (saltarlo no publica). Datos: sesionId, tipo (corto | largo), minutos.' },
};

export type ContextoDeCasoDeUso = Pick<ContextoDeModulo, 'almacen' | 'reloj' | 'nuevoId'>;

export const zonaDelUsuario = (): Zona => crearZona(ZONA_HORARIA);

/** Lo último que terminó: para el aviso en pantalla al volver. */
export interface UltimaFase {
  fase: Fase;
  estado: EstadoFinal;
  finalizadaEn: string;
}

export interface RegistroDeCiclo extends Ciclo {
  clave: typeof CLAVE_CICLO;
  /** Fase que se propone al tocar "Iniciar". */
  proxima: Fase;
  ultima: UltimaFase | null;
}

export interface EstadoDeEstudio {
  activa: SesionActiva | null;
  ciclo: RegistroDeCiclo;
  configuracion: ConfiguracionPomodoro;
}

export const CICLO_POR_DEFECTO: RegistroDeCiclo = { clave: CLAVE_CICLO, ...CICLO_INICIAL, proxima: 'foco', ultima: null };

export async function leerEstado(tx: TransaccionDeLectura): Promise<EstadoDeEstudio> {
  const [activa, ciclo, cfg] = await Promise.all([
    tx.obtener<{ clave: string; sesion: SesionActiva }>(ESTADO, CLAVE_ACTIVA),
    tx.obtener<RegistroDeCiclo>(ESTADO, CLAVE_CICLO),
    tx.obtener<Record<string, unknown>>(ESTADO, CLAVE_CONFIGURACION),
  ]);
  return { activa: activa?.sesion ?? null, ciclo: { ...CICLO_POR_DEFECTO, ...ciclo }, configuracion: configuracionDesdeAlmacen(cfg) };
}

export const duracionDe = (cfg: ConfiguracionPomodoro, fase: Fase) => (fase === 'foco' ? cfg.focoMin : fase === 'corto' ? cfg.cortoMin : cfg.largoMin);
