/** U1 y U2: crear, renombrar, archivar (con deshacer) y restaurar materias. */
import { useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { archivarMateria } from '../aplicacion/archivar-materia';
import { ENTREGABLES, MATERIAS } from '../aplicacion/comun';
import { leerPanel } from '../aplicacion/consultas';
import { crearMateria } from '../aplicacion/crear-materia';
import { renombrarMateria } from '../aplicacion/renombrar-materia';
import { restaurarMateria } from '../aplicacion/restaurar-materia';
import { CreditosInvalidos } from '../dominio/errores';
import { COLORES_DE_MATERIA, CREDITOS_MAX, NOMBRE_MAX, type ColorDeMateria, type Materia } from '../dominio/materia';
import { aria, Campo, enfocarPrimerError, ErrorDeCampo, idDeControl, LineaDeAviso, mensajeDeError, repartirError, type Aviso, type ErroresDeCampo } from './comun';

export function VistaMaterias({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const consulta = useConsulta(ctx.almacen, [MATERIAS, ENTREGABLES], leerPanel);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const tituloActivas = useRef<HTMLHeadingElement>(null);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;

  const { materias, entregables } = consulta.datos;
  const activas = materias.filter((m) => !m.archivada);
  const archivadas = materias.filter((m) => m.archivada);
  const pendientes = (id: string) => entregables.filter((e) => e.materiaId === id && e.estado !== 'completado').length;

  const archivar = async (m: Materia) => {
    try {
      await archivarMateria(ctx, m.id);
      // El elemento desaparece: el foco va al título de la lista para no perderse.
      tituloActivas.current?.focus();
      await ofrecerDeshacer({ mensaje: t('universidad.archivada', { nombre: m.nombre }), deshacer: () => restaurarMateria(ctx, m.id).then(() => undefined) });
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    }
  };

  const restaurar = async (m: Materia) => {
    try {
      await restaurarMateria(ctx, m.id);
      setAviso(null);
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    }
  };

  return (
    <div class="pila">
      <FormularioDeMateria ctx={ctx} />

      <LineaDeAviso aviso={aviso} />

      <section class="seccion">
        <h2 class="seccion__titulo" ref={tituloActivas} tabIndex={-1}>
          {t('universidad.activas')}
        </h2>
        {activas.length === 0 ? (
          <Vacio>{t('universidad.sinActivas')}</Vacio>
        ) : (
          <ul class="lista">
            {activas.map((m) => (
              <FilaDeMateria key={m.id} ctx={ctx} materia={m} pendientes={pendientes(m.id)} alArchivar={() => archivar(m)} />
            ))}
          </ul>
        )}
      </section>

      {archivadas.length > 0 && (
        <details class="detalles">
          <summary>{t('universidad.archivadas', { n: archivadas.length })}</summary>
          <ul class="lista">
            {archivadas.map((m) => (
              <li key={m.id} class="lista__item" data-color={m.color}>
                <div class="fila">
                  <span class="fila__titulo">
                    <span class="marca-color" aria-hidden="true" />
                    {m.nombre}
                  </span>
                  <button type="button" class="boton" onClick={() => restaurar(m)} aria-label={t('universidad.restaurarTitulo', { nombre: m.nombre })}>
                    {t('universidad.restaurar')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <a class="boton" href={hrefDe('/universidad')}>
        {t('universidad.volver')}
      </a>
    </div>
  );
}

function FormularioDeMateria({ ctx }: { ctx: ContextoDeModulo }) {
  const { t } = ctx;
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<ColorDeMateria>('verde');
  const [creditos, setCreditos] = useState('');
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  const enviar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    try {
      const texto = creditos.trim();
      const numero = texto === '' ? null : Number(texto);
      if (numero !== null && Number.isNaN(numero)) throw new CreditosInvalidos('No es un número');
      const m = await crearMateria(ctx, { nombre, color, creditos: numero });
      setNombre('');
      setCreditos('');
      setErrores({});
      setAviso({ ok: true, texto: t('universidad.materiaCreada', { nombre: m.nombre }) });
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
    <form ref={formulario} class="tarjeta" onSubmit={enviar} noValidate>
      <h2 class="tarjeta__titulo">{t('universidad.nuevaMateria')}</h2>
      <Campo campo="nombre" etiqueta={t('universidad.campo.nombre')} ayuda={t('universidad.campo.nombreAyuda', { max: NOMBRE_MAX })} error={errores.nombre}>
        <input
          id={idDeControl('nombre')}
          value={nombre}
          maxLength={NOMBRE_MAX}
          autoComplete="off"
          onInput={(e) => {
            setNombre((e.currentTarget as HTMLInputElement).value);
            setErrores((x) => ({ ...x, nombre: undefined }));
          }}
          {...aria('nombre', errores.nombre, true)}
        />
      </Campo>

      <fieldset class="grupo grupo--en-linea" {...aria('color', errores.color)}>
        <legend>{t('universidad.campo.color')}</legend>
        {COLORES_DE_MATERIA.map((c) => (
          <label key={c} class="opcion" data-color={c}>
            <input type="radio" name="universidad-color" value={c} checked={color === c} onChange={() => setColor(c)} />
            <span class="marca-color" aria-hidden="true" />
            {t(`universidad.color.${c}`)}
          </label>
        ))}
        <ErrorDeCampo campo="color" error={errores.color} />
      </fieldset>

      <Campo campo="creditos" etiqueta={t('universidad.campo.creditos')} error={errores.creditos}>
        <input
          id={idDeControl('creditos')}
          type="number"
          inputMode="numeric"
          min={0}
          max={CREDITOS_MAX}
          step={1}
          value={creditos}
          onInput={(e) => {
            setCreditos((e.currentTarget as HTMLInputElement).value);
            setErrores((x) => ({ ...x, creditos: undefined }));
          }}
          {...aria('creditos', errores.creditos)}
        />
      </Campo>

      <div class="acciones">
        <button type="submit" class="boton boton--primario" disabled={guardando}>
          {t('universidad.crearMateria')}
        </button>
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}

function FilaDeMateria({ ctx, materia: m, pendientes, alArchivar }: { ctx: ContextoDeModulo; materia: Materia; pendientes: number; alArchivar: () => void }) {
  const { t } = ctx;
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(m.nombre);
  const [error, setError] = useState<string | undefined>();
  const campo = useRef<HTMLInputElement>(null);
  const botonRenombrar = useRef<HTMLButtonElement>(null);
  const idCampo = `renombrar-${m.id}`;

  const abrir = () => {
    setNombre(m.nombre);
    setError(undefined);
    setEditando(true);
    queueMicrotask(() => campo.current?.select());
  };
  const cerrar = () => {
    setEditando(false);
    queueMicrotask(() => botonRenombrar.current?.focus());
  };
  const guardar = async (e: Event) => {
    e.preventDefault();
    try {
      await renombrarMateria(ctx, m.id, nombre);
      cerrar();
    } catch (err) {
      setError(repartirError(t, err).campos.nombre ?? mensajeDeError(t, err));
      campo.current?.focus();
    }
  };

  return (
    <li class="lista__item" data-color={m.color}>
      {editando ? (
        <form class="fila" onSubmit={guardar} noValidate>
          <Campo campo={idCampo} etiqueta={t('universidad.renombrarTitulo', { nombre: m.nombre })} error={error} clase="campo fila__principal">
            <input
              id={idDeControl(idCampo)}
              ref={campo}
              value={nombre}
              maxLength={NOMBRE_MAX}
              autoComplete="off"
              onInput={(e) => setNombre((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cerrar();
                }
              }}
              {...aria(idCampo, error)}
            />
          </Campo>
          <span class="acciones">
            <button type="submit" class="boton boton--primario">
              {t('universidad.guardar')}
            </button>
            <button type="button" class="boton" onClick={cerrar}>
              {t('universidad.cancelar')}
            </button>
          </span>
        </form>
      ) : (
        <div class="fila">
          <div class="fila__principal">
            <span class="fila__titulo">
              <span class="marca-color" aria-hidden="true" />
              {m.nombre}
            </span>
            <span class="texto-tenue">
              {[m.creditos !== null ? t('universidad.creditos', { n: m.creditos }) : null, t('universidad.pendientes', { n: pendientes })]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <span class="acciones">
            <button ref={botonRenombrar} type="button" class="boton" onClick={abrir} aria-label={t('universidad.renombrarTitulo', { nombre: m.nombre })}>
              {t('universidad.renombrar')}
            </button>
            <button type="button" class="boton" onClick={alArchivar} aria-label={t('universidad.archivarTitulo', { nombre: m.nombre })}>
              {t('universidad.archivar')}
            </button>
          </span>
        </div>
      )}
    </li>
  );
}
