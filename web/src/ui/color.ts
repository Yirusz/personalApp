/**
 * Atributos para pintar un color de agenda (ADR-0015). Los tokens usan `data-color`
 * (base.css); un hex usa sus dos variantes legibles con `light-dark()`, de modo que
 * siga el tema elegido sin recalcular nada al cambiarlo.
 */
import { esColorHex, rellenoLegible, variantesLegibles, type ColorDeAgenda } from '../nucleo/dominio/color';

export function atributosDeColor(color: ColorDeAgenda | undefined): { 'data-color'?: string; style?: Record<string, string> } {
  if (!color) return {};
  if (!esColorHex(color)) return { 'data-color': color };
  const v = variantesLegibles(color);
  const claro = rellenoLegible(v.claro);
  const oscuro = rellenoLegible(v.oscuro);
  return {
    style: {
      '--color-cat': `light-dark(${v.claro}, ${v.oscuro})`,
      '--color-relleno': `light-dark(${claro.fondo}, ${oscuro.fondo})`,
      '--color-sobre-relleno': `light-dark(${claro.texto}, ${oscuro.texto})`,
    },
  };
}
