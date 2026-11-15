/** Historia 2: registrar un trabajo. */
import { useRef, useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { MATERIAS } from '../aplicacion/comun';
import { leerMaterias } from '../aplicacion/consultas';
import { registrarTrabajo } from '../aplicacion/trabajos';
import { BORRADOR_VACIO, CamposDeTrabajo, enfocarPrimerError, LineaDeAviso, limpiarErrores, repartirError, revisarBorrador, type Aviso, type BorradorDeTrabajo, type ErroresDeCampo } from './comun';

export function VistaNuevoTrabajo({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const consulta = useConsulta(ctx.almacen, [MATERIAS], leerMaterias);
  const [b, setB] = useState<BorradorDeTrabajo>(BORRADOR_VACIO);
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const activas = consulta.datos.filter((m) => !m.archivada);
  if (activas.length === 0) {
    return (
      <div class="pila">
        <Vacio>{t('universidad.sinMaterias')}</Vacio>
        <a class="boton boton--primario" href={hrefDe('/universidad/materias')}>
          {t('universidad.crearMaterias')}
        </a>
      </div>
    );
  }
  const materiaId = b.materiaId || (activas.length === 1 ? activas[0]!.id : '');
  const cambiar = (c: Partial<BorradorDeTrabajo>) => {
    setB((x) => ({ ...x, ...c }));
    setErrores((e) => limpiarErrores(e, c));
  };

  const enviar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    const r = revisarBorrador(ctx, { ...b, materiaId }, { conMateria: true });
    if (!r.valido) {
      setErrores(r.errores);
      enfocarPrimerError(formulario.current);
      return;
    }
    setGuardando(true);
    try {
      await registrarTrabajo(ctx, { materiaId, titulo: b.titulo, tipo: b.tipo, descripcion: b.descripcion, venceEn: r.venceEn!, prioridad: b.prioridad, peso: r.peso });
      setB({ ...BORRADOR_VACIO, materiaId });
      setErrores({});
      setAviso({ ok: true, texto: t('universidad.registrado') });
      formulario.current?.querySelector<HTMLInputElement>('input')?.focus();
    } catch (error) {
      const { campos, general } = repartirError(t, error);
      setErrores(campos);
      if (general) setAviso({ ok: false, texto: general });
      enfocarPrimerError(formulario.current);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form ref={formulario} class="tarjeta pila" onSubmit={enviar} noValidate>
      <CamposDeTrabajo ctx={ctx} borrador={{ ...b, materiaId }} cambiar={cambiar} materias={activas} errores={errores} />
      <div class="acciones">
        <button class="boton boton--primario" type="submit" disabled={guardando}>
          {t('universidad.registrarTrabajo')}
        </button>
        <a class="boton" href={hrefDe('/universidad')}>
          {t('universidad.volver')}
        </a>
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}
