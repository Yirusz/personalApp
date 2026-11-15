/** Errores con nombre del negocio, con clave i18n y campo del formulario si aplica. */

export type CampoDeFormulario =
  | 'nombre'
  | 'profesor'
  | 'periodo'
  | 'color'
  | 'creditos'
  | 'materia'
  | 'titulo'
  | 'tipo'
  | 'descripcion'
  | 'venceEn'
  | 'peso'
  | 'nota'
  | 'subtarea';

export abstract class ErrorDeUniversidad extends Error {
  abstract readonly clave: string;
  readonly campo?: CampoDeFormulario;
  readonly parametros?: Readonly<Record<string, string | number>>;
}

function definir(nombre: string, clave: string, campo?: CampoDeFormulario) {
  return class extends ErrorDeUniversidad {
    override name = nombre;
    readonly clave = clave;
    override readonly campo = campo;
  };
}

/** Texto vacío o demasiado largo en un campo. */
export class TextoInvalido extends ErrorDeUniversidad {
  override name = 'TextoInvalido';
  readonly clave: string;
  override readonly campo: CampoDeFormulario;
  override readonly parametros: { max: number };
  constructor(campo: CampoDeFormulario, motivo: 'vacio' | 'largo', max: number) {
    super(`${campo}: ${motivo}`);
    this.campo = campo;
    this.clave = `universidad.error.${motivo}`;
    this.parametros = { max };
  }
}

export class NombreDeMateriaInvalido extends TextoInvalido {
  constructor(motivo: 'vacio' | 'largo', max: number) {
    super('nombre', motivo, max);
  }
}
export class TituloInvalido extends TextoInvalido {
  constructor(motivo: 'vacio' | 'largo', max: number) {
    super('titulo', motivo, max);
  }
}
export class PeriodoInvalido extends TextoInvalido {
  constructor(motivo: 'vacio' | 'largo', max: number) {
    super('periodo', motivo, max);
  }
}
export class SubtareaInvalida extends ErrorDeUniversidad {
  override name = 'SubtareaInvalida';
  override readonly campo = 'subtarea';
  readonly clave: string;
  override readonly parametros: { max: number };
  constructor(motivo: 'vacia' | 'larga' | 'demasiadas' | 'noExiste', max = 0) {
    super(`Subtarea ${motivo}`);
    this.clave = `universidad.error.subtarea.${motivo}`;
    this.parametros = { max };
  }
}

export class ColorInvalido extends definir('ColorInvalido', 'universidad.error.color', 'color') {}
export class CreditosInvalidos extends definir('CreditosInvalidos', 'universidad.error.creditos', 'creditos') {}
export class MateriaRepetida extends definir('MateriaRepetida', 'universidad.error.materiaRepetida', 'nombre') {}
export class MateriaArchivadaSinTrabajos extends definir('MateriaArchivadaSinTrabajos', 'universidad.error.materiaArchivada', 'materia') {}
export class MateriaNoEncontrada extends definir('MateriaNoEncontrada', 'universidad.error.materiaNoEncontrada', 'materia') {}
export class TrabajoNoEncontrado extends definir('TrabajoNoEncontrado', 'universidad.error.trabajoNoEncontrado') {}
export class FechaInvalida extends definir('FechaInvalida', 'universidad.error.fecha', 'venceEn') {}
export class NotaInvalida extends definir('NotaInvalida', 'universidad.error.nota', 'nota') {}
export class PesoInvalido extends definir('PesoInvalido', 'universidad.error.peso', 'peso') {}
export class TipoBloqueado extends definir('TipoBloqueado', 'universidad.error.tipoBloqueado', 'tipo') {}
export class EstadoNoPermite extends definir('EstadoNoPermite', 'universidad.error.estado') {}
/** Compatibilidad con el nombre anterior (iteración 1). */
export const TransicionInvalida = EstadoNoPermite;
