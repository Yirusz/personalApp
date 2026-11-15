/**
 * Errores con nombre del negocio (guía §11). Cada uno trae la clave i18n del
 * mensaje para el usuario y, si aplica, el campo del formulario afectado.
 */

export type CampoDeFormulario = 'nombre' | 'color' | 'creditos' | 'materia' | 'titulo' | 'venceEn' | 'talla';

export abstract class ErrorDeUniversidad extends Error {
  abstract readonly clave: string;
  readonly campo?: CampoDeFormulario;
  readonly parametros?: Readonly<Record<string, string | number>>;
}

export class NombreDeMateriaInvalido extends ErrorDeUniversidad {
  override name = 'NombreDeMateriaInvalido';
  override readonly campo = 'nombre';
  readonly clave: string;
  override readonly parametros: { max: number };
  constructor(motivo: 'vacio' | 'largo', max: number) {
    super(`Nombre de materia ${motivo === 'vacio' ? 'vacío' : `de más de ${max} caracteres`}`);
    this.clave = `universidad.error.nombre.${motivo}`;
    this.parametros = { max };
  }
}

export class ColorInvalido extends ErrorDeUniversidad {
  override name = 'ColorInvalido';
  override readonly campo = 'color';
  readonly clave = 'universidad.error.color';
}

export class CreditosInvalidos extends ErrorDeUniversidad {
  override name = 'CreditosInvalidos';
  override readonly campo = 'creditos';
  readonly clave = 'universidad.error.creditos';
}

export class MateriaRepetida extends ErrorDeUniversidad {
  override name = 'MateriaRepetida';
  override readonly campo = 'nombre';
  readonly clave = 'universidad.error.materiaRepetida';
}

export class MateriaArchivadaSinEntregables extends ErrorDeUniversidad {
  override name = 'MateriaArchivadaSinEntregables';
  override readonly campo = 'materia';
  readonly clave = 'universidad.error.materiaArchivada';
}

export class MateriaNoEncontrada extends ErrorDeUniversidad {
  override name = 'MateriaNoEncontrada';
  override readonly campo = 'materia';
  readonly clave = 'universidad.error.materiaNoEncontrada';
}

export class EntregableNoEncontrado extends ErrorDeUniversidad {
  override name = 'EntregableNoEncontrado';
  readonly clave = 'universidad.error.entregableNoEncontrado';
}

export class TituloInvalido extends ErrorDeUniversidad {
  override name = 'TituloInvalido';
  override readonly campo = 'titulo';
  readonly clave: string;
  override readonly parametros: { max: number };
  constructor(motivo: 'vacio' | 'largo', max: number) {
    super(`Título ${motivo === 'vacio' ? 'vacío' : `de más de ${max} caracteres`}`);
    this.clave = `universidad.error.titulo.${motivo}`;
    this.parametros = { max };
  }
}

export class FechaInvalida extends ErrorDeUniversidad {
  override name = 'FechaInvalida';
  override readonly campo = 'venceEn';
  readonly clave = 'universidad.error.fecha';
}

export class TallaBloqueada extends ErrorDeUniversidad {
  override name = 'TallaBloqueada';
  override readonly campo = 'talla';
  readonly clave = 'universidad.error.tallaBloqueada';
}

export class EntregableYaCompletado extends ErrorDeUniversidad {
  override name = 'EntregableYaCompletado';
  readonly clave = 'universidad.error.yaCompletado';
}

export class TransicionInvalida extends ErrorDeUniversidad {
  override name = 'TransicionInvalida';
  readonly clave = 'universidad.error.transicion';
}
