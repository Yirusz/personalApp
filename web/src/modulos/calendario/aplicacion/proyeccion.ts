/**
 * CA2: proyección de lo que publican otros módulos con `datos.agenda`. El
 * Calendario no conoce a ningún módulo: procesa cualquier evento con ese dato
 * (historial completo: lo anterior a instalar el Calendario también aparece).
 * Un dato mal formado se omite y se anota en Diagnóstico; nunca detiene la suscripción.
 */
import type { Diagnostico, Suscripcion } from '../../../nucleo/contrato';
import { validarElementoDeAgenda } from '../dominio/externos';
import { AGENDA, type RegistroDeAgenda } from './comun';

export function crearSuscripcionDeAgenda(diagnostico: Diagnostico): Suscripcion {
  return {
    id: 'calendario.agenda',
    tipos: '*',
    almacenes: [AGENDA],
    historial: 'completo',
    async manejar(evento, tx) {
      if (evento.modulo === 'calendario' || !('agenda' in evento.datos)) return;
      let agenda;
      try {
        agenda = validarElementoDeAgenda(evento.datos.agenda);
      } catch (error) {
        diagnostico.registrar('aviso', 'calendario', `Se omitió un elemento de agenda inválido de ${evento.tipo}`, error);
        return;
      }
      const clave = `${evento.modulo}:${agenda.id}`;
      if (agenda.estado === 'eliminado') {
        await tx.borrar(AGENDA, clave);
        return;
      }
      const registro: RegistroDeAgenda = { clave, origen: evento.modulo, agenda, actualizadoEn: evento.ocurridoEn };
      await tx.poner(AGENDA, registro);
    },
  };
}
