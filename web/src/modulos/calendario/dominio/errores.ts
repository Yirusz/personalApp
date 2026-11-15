/** Errores con nombre del negocio, con clave i18n y campo del formulario si aplica. */

export type CampoDeEvento = 'titulo' | 'lugar' | 'notas' | 'color' | 'inicio' | 'fin' | 'recordatorios' | 'recurrencia' | 'compromiso';

export abstract class ErrorDeCalendario extends Error {
  abstract readonly clave: string;
  readonly campo?: CampoDeEvento;
  readonly parametros?: Readonly<Record<string, string | number>>;
}

function definir(nombre: string, clave: string, campo?: CampoDeEvento) {
  return class extends ErrorDeCalendario {
    override name = nombre;
    readonly clave = clave;
    override readonly campo = campo;
  };
}

export class TituloDeEventoInvalido extends ErrorDeCalendario {
  override name = 'TituloDeEventoInvalido';
  override readonly campo = 'titulo';
  readonly clave: string;
  override readonly parametros: { max: number };
  constructor(motivo: 'vacio' | 'largo', max: number) {
    super(`Título ${motivo}`);
    this.clave = `calendario.error.titulo.${motivo}`;
    this.parametros = { max };
  }
}

export class TextoDemasiadoLargo extends ErrorDeCalendario {
  override name = 'TextoDemasiadoLargo';
  readonly clave = 'calendario.error.textoLargo';
  override readonly campo: CampoDeEvento;
  override readonly parametros: { max: number };
  constructor(campo: 'lugar' | 'notas', max: number) {
    super(`${campo} de más de ${max} caracteres`);
    this.campo = campo;
    this.parametros = { max };
  }
}

export class FechaDeEventoInvalida extends ErrorDeCalendario {
  override name = 'FechaDeEventoInvalida';
  readonly clave = 'calendario.error.fecha';
  override readonly campo: CampoDeEvento;
  constructor(campo: 'inicio' | 'fin', mensaje: string) {
    super(mensaje);
    this.campo = campo;
  }
}

export class FinAntesDeInicio extends definir('FinAntesDeInicio', 'calendario.error.finAntesDeInicio', 'fin') {}
export class DuracionExcesiva extends definir('DuracionExcesiva', 'calendario.error.duracion', 'fin') {}
export class ColorDeEventoInvalido extends definir('ColorDeEventoInvalido', 'calendario.error.color', 'color') {}
export class RecordatorioInvalido extends definir('RecordatorioInvalido', 'calendario.error.recordatorio', 'recordatorios') {}
export class RecurrenciaInvalida extends definir('RecurrenciaInvalida', 'calendario.error.recurrencia', 'recurrencia') {}
export class CompromisoInvalido extends definir('CompromisoInvalido', 'calendario.error.compromiso', 'compromiso') {}
export class CumplimientoFueraDeTiempo extends definir('CumplimientoFueraDeTiempo', 'calendario.error.cumplimiento') {}
export class OcurrenciaInexistente extends definir('OcurrenciaInexistente', 'calendario.error.ocurrencia') {}
export class EventoNoEncontrado extends definir('EventoNoEncontrado', 'calendario.error.eventoNoEncontrado') {}
export class ElementoDeAgendaInvalido extends definir('ElementoDeAgendaInvalido', 'calendario.error.elementoExterno') {}
