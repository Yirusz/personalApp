/** H8: fichas propias (crear, editar, eliminar con deshacer) y las que aportan otros módulos (solo lectura). */
import { useRef, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import type { ColorDeAgenda } from '../../../nucleo/dominio/color';
import { FICHA_SEMANAS_MAX, FICHA_SEMANAS_POR_DEFECTO, type FichaDeCalendario, type RepeticionDeFicha } from '../../../nucleo/dominio/fichas';
import { atributosDeColor } from '../../../ui/color';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer, useOcultoPorDeshacer } from '../../../ui/deshacer';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { FICHAS } from '../aplicacion/comun';
import { crearFicha, editarFicha, eliminarFicha, leerFichasPropias, MODULO } from '../aplicacion/fichas';
import { TITULO_MAX } from '../dominio/evento';
import type { DatosDeFichaPropia, FichaPropia } from '../dominio/ficha';
import { aria, Campo, enfocarPrimerError, ErrorDeCampo, LineaDeAviso, repartirError, SelectorDeColor, useFichas, type Aviso, type ErroresDeCampo } from './comun';

const DURACIONES = [30, 45, 60, 90, 120, 150, 180, 240];

export function textoDeDuracion(ctx: ContextoDeModulo, min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return ctx.t('calendario.fichas.minutos', { n: m });
  return m === 0 ? ctx.t('calendario.fichas.horas', { n: h }) : ctx.t('calendario.fichas.horasMinutos', { h, m });
}

export function textoDeFicha(ctx: ContextoDeModulo, f: FichaDeCalendario): string {
  const rep = f.repeticion.tipo === 'semanal' ? ctx.t('calendario.fichas.cadaSemana', { n: f.repeticion.semanas }) : ctx.t('calendario.fichas.unaVez');
  return [f.detalle, textoDeDuracion(ctx, f.duracionMin), rep].filter(Boolean).join(' · ');
}

export function VistaFichas({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const propias = useConsulta(ctx.almacen, [FICHAS], leerFichasPropias);
  const deModulos = useFichas(ctx);
  const oculto = useOcultoPorDeshacer();
  const [editando, setEditando] = useState<string | null>(null);

  if (propias.estado === 'cargando') return <Cargando />;
  if (propias.estado === 'error') return <ErrorConReintento error={propias.error} reintentar={propias.reintentar} />;
  const mias = propias.datos.filter((f) => f.id !== oculto);
  const otros = deModulos?.grupos.filter((g) => g.modulo !== MODULO) ?? [];

  const eliminar = (f: FichaPropia) => void ofrecerDeshacer({ mensaje: t('calendario.fichas.eliminada', { titulo: f.titulo }), ocultar: f.id, confirmar: () => eliminarFicha(ctx, f.id) });

  return (
    <div class="pila">
      <p class="texto-tenue">{t('calendario.fichas.explicacion')}</p>

      <FormularioDeFicha
        ctx={ctx}
        prefijo="nueva-"
        titulo={t('calendario.fichas.nueva')}
        inicial={{ titulo: '', color: 'azul', duracionMin: 60, repeticion: { tipo: 'semanal', semanas: FICHA_SEMANAS_POR_DEFECTO } }}
        textoBoton={t('calendario.fichas.crear')}
        limpiar
        guardar={async (d) => t('calendario.fichas.creada', { titulo: (await crearFicha(ctx, d)).titulo })}
      />

      <Seccion titulo={t('calendario.fichasPropias')}>
        {mias.length === 0 ? (
          <Vacio>{t('calendario.fichas.sinPropias')}</Vacio>
        ) : (
          <ul class="lista">
            {mias.map((f) => (
              <li key={f.id} class="lista__item" {...atributosDeColor(f.color)}>
                {editando === f.id ? (
                  <FormularioDeFicha
                    ctx={ctx}
                    prefijo="editar-"
                    titulo={t('calendario.fichas.editarTitulo', { titulo: f.titulo })}
                    inicial={f}
                    textoBoton={t('calendario.guardar')}
                    guardar={async (d) => {
                      await editarFicha(ctx, f.id, d);
                      setEditando(null);
                      return t('calendario.guardado');
                    }}
                    cancelar={() => setEditando(null)}
                  />
                ) : (
                  <div class="fila">
                    <div class="fila__principal">
                      <span class="fila__titulo">
                        <span class="marca-color" aria-hidden="true" />
                        {f.titulo}
                      </span>
                      <span class="texto-tenue">{textoDeFicha(ctx, f)}</span>
                    </div>
                    <span class="acciones">
                      <button type="button" class="boton" aria-label={t('calendario.fichas.editarTitulo', { titulo: f.titulo })} onClick={() => setEditando(f.id)}>
                        {t('calendario.fichas.editar')}
                      </button>
                      <button type="button" class="boton" aria-label={t('calendario.fichas.eliminarTitulo', { titulo: f.titulo })} onClick={() => eliminar(f)}>
                        {t('calendario.fichas.eliminar')}
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {!deModulos ? (
        <Cargando />
      ) : (
        otros.map((g) => (
          <Seccion key={g.modulo} titulo={t(g.nombre)}>
            {g.fichas.length === 0 ? (
              <Vacio>{t('calendario.fichas.grupoVacio')}</Vacio>
            ) : (
              <ul class="lista">
                {g.fichas.map((f) => (
                  <li key={f.id} class="lista__item" {...atributosDeColor(f.color)}>
                    <span class="fila__titulo">
                      <span class="marca-color" aria-hidden="true" />
                      {f.titulo}
                    </span>
                    <span class="texto-tenue">{textoDeFicha(ctx, f)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p class="campo__ayuda">{t('calendario.fichas.deModulo', { modulo: t(`${g.modulo}.nombre`) })}</p>
          </Seccion>
        ))
      )}
      {deModulos && deModulos.fallos.length > 0 && <p class="aviso aviso--alerta">{t('calendario.fichas.fallo', { fuentes: deModulos.fallos.map((f) => t(f.nombre)).join(', ') })}</p>}

      <a class="boton" href={hrefDe('/calendario/ver/semana/' + ctx.formatos.diaLocal(ctx.reloj.ahora().toISOString()))}>
        {t('calendario.fichas.irASemana')}
      </a>
    </div>
  );
}

function FormularioDeFicha({
  ctx,
  prefijo,
  titulo,
  inicial,
  textoBoton,
  guardar,
  cancelar,
  limpiar = false,
}: {
  ctx: ContextoDeModulo;
  prefijo: string;
  titulo: string;
  inicial: DatosDeFichaPropia;
  textoBoton: string;
  guardar: (d: DatosDeFichaPropia) => Promise<string>;
  cancelar?: () => void;
  limpiar?: boolean;
}) {
  const { t } = ctx;
  const [d, setD] = useState({ titulo: inicial.titulo, color: inicial.color as ColorDeAgenda, duracionMin: inicial.duracionMin, semanal: inicial.repeticion.tipo === 'semanal', semanas: String(inicial.repeticion.tipo === 'semanal' ? inicial.repeticion.semanas : FICHA_SEMANAS_POR_DEFECTO) });
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const cambiar = (c: Partial<typeof d>) => {
    setD((x) => ({ ...x, ...c }));
    setErrores((e) => {
      const copia = { ...e };
      for (const k of Object.keys(c)) delete copia[(k === 'semanal' ? 'semanas' : k === 'duracionMin' ? 'duracion' : k) as keyof ErroresDeCampo];
      return copia;
    });
  };

  const enviar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    setGuardando(true);
    try {
      const repeticion: RepeticionDeFicha = d.semanal ? { tipo: 'semanal', semanas: Number(d.semanas) } : { tipo: 'unica' };
      const mensaje = await guardar({ titulo: d.titulo, color: d.color, duracionMin: d.duracionMin, repeticion });
      if (limpiar) setD((x) => ({ ...x, titulo: '' }));
      setErrores({});
      setAviso({ ok: true, texto: mensaje });
      if (limpiar) formulario.current?.querySelector<HTMLInputElement>('input')?.focus();
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
      <Campo campo={`${prefijo}titulo`} etiqueta={t('calendario.campo.titulo')} error={errores.titulo}>
        <input value={d.titulo} maxLength={TITULO_MAX} autoComplete="off" onInput={(e) => cambiar({ titulo: (e.currentTarget as HTMLInputElement).value })} {...aria(`${prefijo}titulo`, errores.titulo)} />
      </Campo>
      <div class="cal-dos-columnas">
        <Campo campo={`${prefijo}duracion`} etiqueta={t('calendario.fichas.duracion')} error={errores.duracion}>
          <select value={d.duracionMin} onChange={(e) => cambiar({ duracionMin: Number((e.currentTarget as HTMLSelectElement).value) })} {...aria(`${prefijo}duracion`, errores.duracion)}>
            {[...new Set([...DURACIONES, d.duracionMin])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {textoDeDuracion(ctx, m)}
                </option>
              ))}
          </select>
        </Campo>
        <fieldset class="grupo pila">
          <legend>{t('calendario.fichas.repeticion')}</legend>
          <label class="opcion">
            <input type="radio" name={`calendario-${prefijo}repeticion`} checked={!d.semanal} onChange={() => cambiar({ semanal: false })} />
            {t('calendario.fichas.unaVez')}
          </label>
          <div class="fila cal-fila-corta">
            <label class="opcion">
              <input type="radio" name={`calendario-${prefijo}repeticion`} checked={d.semanal} onChange={() => cambiar({ semanal: true })} />
              {t('calendario.fichas.semanalDurante')}
            </label>
            <input
              class="cal-numero"
              type="number"
              inputMode="numeric"
              min={1}
              max={FICHA_SEMANAS_MAX}
              disabled={!d.semanal}
              value={d.semanas}
              onInput={(e) => cambiar({ semanas: (e.currentTarget as HTMLInputElement).value })}
              {...aria(`${prefijo}semanas`, errores.semanas)}
              aria-label={t('calendario.fichas.semanas')}
            />
            <span>{t('calendario.fichas.semanas')}</span>
          </div>
          <ErrorDeCampo campo={`${prefijo}semanas`} error={errores.semanas} />
        </fieldset>
      </div>
      <SelectorDeColor ctx={ctx} nombre={`${prefijo}color`} valor={d.color} cambiar={(color) => cambiar({ color })} error={errores.color} />
      <div class="acciones">
        <button type="submit" class="boton boton--primario" disabled={guardando}>
          {textoBoton}
        </button>
        {cancelar && (
          <button type="button" class="boton" onClick={cancelar}>
            {t('calendario.cancelar')}
          </button>
        )}
      </div>
      <LineaDeAviso aviso={aviso} />
    </form>
  );
}
