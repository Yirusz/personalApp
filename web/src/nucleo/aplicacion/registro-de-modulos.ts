/**
 * Valida el conjunto de módulos al arrancar (falla rápido y con todos los
 * problemas juntos) y ofrece consultas sobre rutas, navegación y textos.
 */
import type { DefinicionDeModulo, EntradaDeNavegacion, RutaDeModulo, TarjetaDeInicio } from '../contrato';
import { PATRON_TIPO_EVENTO, moduloDelTipo } from '../dominio/evento';

const PATRON_ID = /^[a-z][a-z0-9]*$/;
/** Ids que el núcleo usa para sí mismo. */
const RESERVADOS = new Set(['nucleo', 'inicio', 'ajustes', 'diagnostico', 'mas']);

export class ModulosInvalidos extends Error {
  override name = 'ModulosInvalidos';
  constructor(readonly problemas: readonly string[]) {
    super(`Hay ${problemas.length} problema(s) en los módulos:\n- ${problemas.join('\n- ')}`);
  }
}

export interface RutaRegistrada extends RutaDeModulo {
  moduloId: string;
}

export interface NavegacionRegistrada extends EntradaDeNavegacion {
  moduloId: string;
}

export class RegistroDeModulos {
  readonly modulos: readonly DefinicionDeModulo[];

  constructor(definiciones: readonly DefinicionDeModulo[], rutasDelNucleo: readonly string[] = []) {
    const problemas = validar(definiciones, rutasDelNucleo);
    if (problemas.length > 0) throw new ModulosInvalidos(problemas);
    this.modulos = [...definiciones].sort((a, b) => a.id.localeCompare(b.id));
  }

  rutas(): RutaRegistrada[] {
    return this.modulos.flatMap((m) => m.rutas.map((r) => ({ ...r, moduloId: m.id })));
  }

  navegacion(): NavegacionRegistrada[] {
    return this.modulos
      .filter((m) => m.navegacion)
      .map((m) => ({ ...m.navegacion!, moduloId: m.id }))
      .sort((a, b) => a.orden - b.orden);
  }

  tarjetasDeInicio(): (TarjetaDeInicio & { moduloId: string })[] {
    return this.modulos
      .flatMap((m) => (m.tarjetasDeInicio ?? []).map((t) => ({ ...t, moduloId: m.id })))
      .sort((a, b) => a.orden - b.orden);
  }

  textos(): Record<string, string> {
    return Object.assign({}, ...this.modulos.map((m) => m.textos)) as Record<string, string>;
  }
}

function validar(definiciones: readonly DefinicionDeModulo[], rutasDelNucleo: readonly string[]): string[] {
  const problemas: string[] = [];
  const ids = new Set<string>();
  const rutas = new Map<string, string>(rutasDelNucleo.map((r) => [r, 'nucleo']));

  for (const m of definiciones) {
    const donde = `módulo "${m.id}"`;
    if (!PATRON_ID.test(m.id)) problemas.push(`${donde}: el id debe ser minúsculas y dígitos`);
    if (RESERVADOS.has(m.id)) problemas.push(`${donde}: el id está reservado por el núcleo`);
    if (ids.has(m.id)) problemas.push(`${donde}: id duplicado`);
    ids.add(m.id);

    if (!/^\d+\.\d+\.\d+$/.test(m.version)) problemas.push(`${donde}: versión "${m.version}" no es SemVer`);

    for (const clave of Object.keys(m.textos)) {
      if (!clave.startsWith(`${m.id}.`)) problemas.push(`${donde}: el texto "${clave}" debe empezar por "${m.id}."`);
    }
    const textoExiste = (clave: string) => clave in m.textos;
    if (!textoExiste(m.nombre)) problemas.push(`${donde}: falta el texto del nombre "${m.nombre}"`);

    m.migraciones.forEach((mig, i) => {
      if (mig.version !== i + 1) problemas.push(`${donde}: migración en posición ${i + 1} tiene versión ${mig.version}`);
    });

    for (const tipo of Object.keys(m.eventos)) {
      if (!PATRON_TIPO_EVENTO.test(tipo)) problemas.push(`${donde}: tipo de evento inválido "${tipo}" (use modulo.NombreEnPasado)`);
      else if (moduloDelTipo(tipo) !== m.id) problemas.push(`${donde}: el evento "${tipo}" debe empezar por "${m.id}."`);
    }

    for (const r of m.rutas) {
      if (!r.patron.startsWith(`/${m.id}`)) problemas.push(`${donde}: la ruta "${r.patron}" debe empezar por "/${m.id}"`);
      const otro = rutas.get(r.patron);
      if (otro) problemas.push(`${donde}: la ruta "${r.patron}" ya la usa "${otro}"`);
      rutas.set(r.patron, m.id);
      if (!textoExiste(r.titulo)) problemas.push(`${donde}: falta el texto del título "${r.titulo}"`);
    }

    if (m.navegacion) {
      if (!m.rutas.some((r) => r.patron === m.navegacion!.ruta)) {
        problemas.push(`${donde}: la navegación apunta a "${m.navegacion.ruta}", que no es una ruta del módulo`);
      }
      if (!textoExiste(m.navegacion.etiqueta)) problemas.push(`${donde}: falta el texto "${m.navegacion.etiqueta}"`);
    }
  }
  return problemas;
}
