/** Historia 1: crear, editar, archivar (con deshacer) y restaurar materias, agrupadas por periodo académico. */
import { useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { zonaDelUsuario } from '../aplicacion/comun';
import { ALMACENES_DEL_PANEL, leerPanel } from '../aplicacion/consultas';
import { archivarMateria, crearMateria, editarMateria, restaurarMateria } from '../aplicacion/materias';
import { CreditosInvalidos } from '../dominio/errores';
import { COLORES_DE_MATERIA, CREDITOS_MAX, NOMBRE_MAX, PERIODO_MAX, periodoSugerido, PROFESOR_MAX, type ColorDeMateria, type DatosDeMateria, type Materia } from '../dominio/materia';
import { esActivo } from '../dominio/trabajo';
import { aria, Campo, enfocarPrimerError, LineaDeAviso, mensajeDeError, repartirError, type Aviso, type ErroresDeCampo } from './comun';

export function VistaMaterias({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const consulta = useConsulta(ctx.almacen, ALMACENES_DEL_PANEL, leerPanel);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const tituloActivas = useRef<HTMLHeadingElement>(null);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const { materias, trabajos } = consulta.datos;
  const activas = materias.filter((m) => !m.archivada);
  const archivadas = materias.filter((m) => m.archivada);
  const periodos = [...new Set(activas.map((m) => m.periodo))];
  const pendientes = (id: string) => trabajos.filter((x) => x.materiaId === id && esActivo(x.estado)).length;
  const sugerido = periodos[0] ?? periodoSugerido(zonaDelUsuario().aCivil(ctx.reloj.ahora().getTime()).fecha);

  const archivar = async (m: Materia) => {
    try {
      await archivarMateria(ctx, m.id);
      tituloActivas.current?.focus();
      await ofrecerDeshacer({ mensaje: t('universidad.archivada', { nombre: m.nombre }), deshacer: () => restaurarMateria(ctx, m.id).then(() => undefined) });
    } catch (error) {
      setAviso({ ok: false, texto: mensajeDeError(t, error) });
    }
  };

  return (
    <div class="pila">
      <FormularioDeMateria
        ctx={ctx}
        titulo={t('universidad.nuevaMateria')}
        inicial={{ nombre: '', profesor: '', color: 'verde', periodo: sugerido, creditos: null }}
        textoBoton={t('universidad.crearMateria')}
        limpiarAlGuardar
        guardar={async (d) => t('universidad.materiaCreada', { nombre: (await crearMateria(ctx, d)).nombre })}
      />
      <LineaDeAviso aviso={aviso} />

      <section class="seccion pila">
        <h2 class="seccion__titulo" ref={tituloActivas} tabIndex={-1}>
          {t('universidad.activas')}
        </h2>
        {activas.length === 0 && <Vacio>{t('universidad.sinActivas')}</Vacio>}
        {periodos.map((p) => (
          <section key={p} class="pila" aria-labelledby={`universidad-periodo-${p}`}>
            <h3 id={`universidad-periodo-${p}`} class="universidad-grupo">
              {t('universidad.periodo', { periodo: p })}
            </h3>
            <ul class="lista">
              {activas
                .filter((m) => m.periodo === p)
                .map((m) => (
                  <li key={m.id} class="lista__item" data-color={m.color}>
                    {editando === m.id ? (
                      <FormularioDeMateria
                        ctx={ctx}
                        titulo={t('universidad.editarMateria', { nombre: m.nombre })}
                        inicial={m}
                        textoBoton={t('universidad.guardar')}
                        guardar={async (d) => {
                          await editarMateria(ctx, m.id, d);
                          setEditando(null);
                          return t('universidad.guardado');
                        }}
                        cancelar={() => setEditando(null)}
                      />
                    ) : (
                      <div class="fila">
                        <div class="fila__principal">
                          <span class="fila__titulo">
                            <span class="marca-color" aria-hidden="true" />
                            {m.nombre}
                          </span>
                          <span class="texto-tenue">
                            {[m.profesor || null, m.creditos !== null ? t('universidad.creditos', { n: m.creditos }) : null, t('universidad.pendientes', { n: pendientes(m.id) })].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        <span class="acciones">
                          <button type="button" class="boton" onClick={() => setEditando(m.id)} aria-label={t('universidad.editarTitulo', { nombre: m.nombre })}>
                            {t('universidad.editar')}
                          </button>
                          <button type="button" class="boton" onClick={() => void archivar(m)} aria-label={t('universidad.archivarTitulo', { nombre: m.nombre })}>
                            {t('universidad.archivar')}
                          </button>
                        </span>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
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
                    {m.nombre} <span class="texto-tenue">({m.periodo})</span>
                  </span>
                  <button
                    type="button"
                    class="boton"
                    aria-label={t('universidad.restaurarTitulo', { nombre: m.nombre })}
                    onClick={() => void restaurarMateria(ctx, m.id).catch((e: unknown) => setAviso({ ok: false, texto: mensajeDeError(t, e) }))}
                  >
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

function FormularioDeMateria({
  ctx,
  titulo,
  inicial,
  textoBoton,
  guardar,
  cancelar,
  limpiarAlGuardar = false,
}: {
  ctx: ContextoDeModulo;
  titulo: string;
  inicial: DatosDeMateria;
  textoBoton: string;
  guardar: (d: DatosDeMateria) => Promise<string>;
  cancelar?: () => void;
  limpiarAlGuardar?: boolean;
}) {
  const { t } = ctx;
  const [d, setD] = useState({ ...inicial, creditos: inicial.creditos === null ? '' : String(inicial.creditos) });
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  // Ids únicos por formulario (puede haber uno de creación y uno de edición a la vez).
  const pre = cancelar ? 'editar-' : 'nueva-';
  const cambiar = (c: Partial<typeof d>) => {
    setD((x) => ({ ...x, ...c }));
    setErrores((e) => {
      const copia = { ...e };
      for (const k of Object.keys(c)) delete copia[k as keyof ErroresDeCampo];
      return copia;
    });
  };
  const valor = (e: Event) => (e.currentTarget as HTMLInputElement).value;

  const enviar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    try {
      const texto = d.creditos.trim();
      const creditos = texto === '' ? null : Number(texto);
      if (creditos !== null && Number.isNaN(creditos)) throw new CreditosInvalidos('No es un número');
      const mensaje = await guardar({ nombre: d.nombre, profesor: d.profesor, color: d.color, periodo: d.periodo, creditos });
      if (limpiarAlGuardar) setD((x) => ({ ...x, nombre: '', profesor: '', creditos: '' }));
      setErrores({});
      setAviso({ ok: true, texto: mensaje });
      if (limpiarAlGuardar) formulario.current?.querySelector<HTMLInputElement>('input')?.focus();
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
    <form ref={formulario} class="tarjeta pila" onSubmit={enviar} noValidate onKeyDown={(e) => cancelar && e.key === 'Escape' && cancelar()}>
      <h2 class="tarjeta__titulo">{titulo}</h2>
      <Campo campo={`${pre}nombre`} etiqueta={t('universidad.campo.nombre')} error={errores.nombre}>
        <input value={d.nombre} maxLength={NOMBRE_MAX} autoComplete="off" onInput={(e) => cambiar({ nombre: valor(e) })} {...aria(`${pre}nombre`, errores.nombre)} />
      </Campo>
      <div class="filtros">
        <Campo campo={`${pre}profesor`} etiqueta={t('universidad.campo.profesor')} error={errores.profesor}>
          <input value={d.profesor} maxLength={PROFESOR_MAX} onInput={(e) => cambiar({ profesor: valor(e) })} {...aria(`${pre}profesor`, errores.profesor)} />
        </Campo>
        <Campo campo={`${pre}periodo`} etiqueta={t('universidad.campo.periodo')} ayuda={t('universidad.campo.periodoAyuda')} error={errores.periodo}>
          <input value={d.periodo} maxLength={PERIODO_MAX} onInput={(e) => cambiar({ periodo: valor(e) })} {...aria(`${pre}periodo`, errores.periodo, true)} />
        </Campo>
        <Campo campo={`${pre}creditos`} etiqueta={t('universidad.campo.creditos')} error={errores.creditos}>
          <input type="number" inputMode="numeric" min={0} max={CREDITOS_MAX} step={1} value={d.creditos} onInput={(e) => cambiar({ creditos: valor(e) })} {...aria(`${pre}creditos`, errores.creditos)} />
        </Campo>
      </div>
      <fieldset class="grupo grupo--en-linea">
        <legend>{t('universidad.campo.color')}</legend>
        {COLORES_DE_MATERIA.map((c) => (
          <label key={c} class="opcion" data-color={c}>
            <input type="radio" name={`universidad-${pre}color`} checked={d.color === c} onChange={() => cambiar({ color: c as ColorDeMateria })} />
            <span class="marca-color" aria-hidden="true" />
            {t(`universidad.color.${c}`)}
          </label>
        ))}
      </fieldset>
      <div class="acciones">
        <button type="submit" class="boton boton--primario" disabled={guardando}>
          {textoBoton}
        </button>
        {cancelar && (
          <button type="button" class="boton" onClick={cancelar}>
            {t('universidad.cancelar')}
          </button>
        )}
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}
