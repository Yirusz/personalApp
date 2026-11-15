/** U3: registrar un entregable. */
import { useRef, useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { MATERIAS } from '../aplicacion/comun';
import { leerMaterias } from '../aplicacion/consultas';
import { registrarEntregable } from '../aplicacion/registrar-entregable';
import { FechaInvalida } from '../dominio/errores';
import { BORRADOR_VACIO, CamposDeEntregable, enfocarPrimerError, LineaDeAviso, repartirError, type Aviso, type BorradorDeEntregable, type ErroresDeCampo } from './comun';

export function VistaNuevoEntregable({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const consulta = useConsulta(ctx.almacen, [MATERIAS], leerMaterias);
  const [borrador, setBorrador] = useState<BorradorDeEntregable>(BORRADOR_VACIO);
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  // U2: una materia archivada no aparece como opción.
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
  // Con una sola materia, se elige sola.
  const elegida = borrador.materiaId || (activas.length === 1 ? activas[0]!.id : '');

  const cambiar = (cambios: Partial<BorradorDeEntregable>) => {
    setBorrador((b) => ({ ...b, ...cambios }));
    setErrores((e) => {
      const copia = { ...e };
      for (const campo of Object.keys(cambios)) delete copia[campo === 'materiaId' ? 'materia' : campo === 'venceEnLocal' ? 'venceEn' : (campo as keyof ErroresDeCampo)];
      return copia;
    });
  };

  const enviar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    try {
      const venceEn = ctx.formatos.desdeEntradaLocal(borrador.venceEnLocal);
      if (!venceEn) throw new FechaInvalida('Fecha vacía o inválida');
      await registrarEntregable(ctx, { ...borrador, materiaId: elegida, venceEn });
      // Se conserva la materia para registrar varios seguidos.
      setBorrador({ ...BORRADOR_VACIO, materiaId: elegida });
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
    <div class="pila">
      <form ref={formulario} class="tarjeta" onSubmit={enviar} noValidate>
        <CamposDeEntregable ctx={ctx} borrador={{ ...borrador, materiaId: elegida }} cambiar={cambiar} materias={activas} errores={errores} />
        <div class="acciones">
          <button class="boton boton--primario" type="submit" disabled={guardando}>
            {t('universidad.registrarEntregable')}
          </button>
          <a class="boton" href={hrefDe('/universidad')}>
            {t('universidad.volver')}
          </a>
        </div>
        <LineaDeAviso aviso={aviso} />
      </form>
    </div>
  );
}
