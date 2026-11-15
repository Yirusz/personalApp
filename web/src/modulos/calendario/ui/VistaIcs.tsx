/** CA10 y CA11: exportar e importar .ics (con vista previa y sin duplicar). */
import { useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { COLORES_CATEGORICOS, type ColorCategorico } from '../../../nucleo/dominio/agenda';
import { descargarArchivo, leerArchivoComoTexto } from '../../../nucleo/infraestructura/plataforma';
import { Seccion } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { AGENDA, EVENTOS } from '../aplicacion/comun';
import { generarIcs, importarEventos, leerParaExportar, prepararImportacion, type AvisoDeImportacion, type Preparacion } from '../aplicacion/importar-exportar';
import { Campo, idDeControl, LineaDeAviso, type Aviso } from './comun';

export function VistaIcs({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const [incluirExternos, setIncluirExternos] = useState(true);
  const [avisoExportar, setAvisoExportar] = useState<Aviso | null>(null);
  const [color, setColor] = useState<ColorCategorico>('gris');
  const [previa, setPrevia] = useState<Preparacion | null>(null);
  const [avisoImportar, setAvisoImportar] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    setOcupado(true);
    try {
      const ahora = ctx.reloj.ahora();
      const datos = await ctx.almacen.leer([EVENTOS, AGENDA], (tx) => leerParaExportar(tx, incluirExternos));
      descargarArchivo(`ludus-calendario-${ctx.formatos.diaLocal(ahora)}.ics`, await generarIcs(datos, ahora), 'text/calendar');
      setAvisoExportar({ ok: true, texto: t('calendario.ics.exportado', { n: datos.eventos.length + datos.externos.length }) });
    } catch {
      setAvisoExportar({ ok: false, texto: t('calendario.error.inesperado') });
    } finally {
      setOcupado(false);
    }
  };

  const elegirArchivo = async (e: Event) => {
    const archivo = (e.currentTarget as HTMLInputElement).files?.[0];
    setPrevia(null);
    setAvisoImportar(null);
    if (!archivo) return;
    setOcupado(true);
    try {
      setPrevia(await prepararImportacion(await leerArchivoComoTexto(archivo), ctx.reloj.ahora(), color));
    } catch (error) {
      setAvisoImportar({ ok: false, texto: t(error instanceof Error && 'clave' in error ? String(error.clave) : 'calendario.ics.error.lectura') });
    } finally {
      setOcupado(false);
    }
  };

  const importar = async () => {
    if (!previa) return;
    setOcupado(true);
    try {
      const conColor = previa.validos.map((v) => ({ ...v, datos: { ...v.datos, color: v.datos.color === 'azul' ? color : v.datos.color } }));
      const r = await importarEventos(ctx, conColor);
      setPrevia(null);
      setAvisoImportar({ ok: true, texto: t('calendario.ics.importado', r) });
    } catch {
      setAvisoImportar({ ok: false, texto: t('calendario.error.inesperado') });
    } finally {
      setOcupado(false);
    }
  };

  const textoAviso = (a: AvisoDeImportacion) =>
    t(`calendario.ics.aviso.${a.motivo}`, { titulo: a.titulo, detalle: a.detalle ?? '', error: a.error ? t(a.error) : '' });

  return (
    <div class="pila">
      <Seccion titulo={t('calendario.ics.exportar')}>
        <div class="tarjeta pila">
          <p>{t('calendario.ics.exportarAyuda')}</p>
          <p class="texto-tenue">{t('calendario.garantias.alternativa')}</p>
          <label class="opcion">
            <input type="checkbox" checked={incluirExternos} onChange={(e) => setIncluirExternos((e.currentTarget as HTMLInputElement).checked)} />
            {t('calendario.ics.incluirExternos')}
          </label>
          <div class="acciones">
            <button type="button" class="boton boton--primario" disabled={ocupado} onClick={exportar}>
              ⬇ {t('calendario.ics.descargar')}
            </button>
          </div>
          <LineaDeAviso aviso={avisoExportar} />
        </div>
      </Seccion>

      <Seccion titulo={t('calendario.ics.importar')}>
        <div class="tarjeta pila">
          <p>{t('calendario.ics.importarAyuda')}</p>
          <Campo campo="color-importados" etiqueta={t('calendario.ics.colorImportados')}>
            <select id={idDeControl('color-importados')} value={color} onChange={(e) => setColor((e.currentTarget as HTMLSelectElement).value as ColorCategorico)}>
              {COLORES_CATEGORICOS.map((c) => (
                <option key={c} value={c}>
                  {t(`calendario.color.${c}`)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo campo="archivo" etiqueta={t('calendario.ics.archivo')}>
            <input id={idDeControl('archivo')} type="file" accept=".ics,text/calendar" disabled={ocupado} onChange={elegirArchivo} />
          </Campo>
          {previa && (
            <div class="pila cal-previa" role="region" aria-label={t('calendario.ics.previa', { nombre: previa.nombre ? `: ${previa.nombre}` : '' })}>
              <h3 class="tarjeta__titulo">{t('calendario.ics.previa', { nombre: previa.nombre ? `: ${previa.nombre}` : '' })}</h3>
              <p>{previa.validos.length > 0 ? t('calendario.ics.validos', { n: previa.validos.length }) : t('calendario.ics.nadaQueImportar')}</p>
              {previa.validos.length > 0 && (
                <ul class="cal-lista-simple">
                  {previa.validos.slice(0, 8).map((v) => (
                    <li key={v.uid}>
                      {v.datos.titulo} · <span class="texto-tenue">{v.datos.todoElDia ? v.datos.inicio : ctx.formatos.fechaHora(v.datos.inicio)}</span>
                      {v.datos.recurrencia && ' ↻'}
                    </li>
                  ))}
                  {previa.validos.length > 8 && <li class="texto-tenue">{t('calendario.mas', { n: previa.validos.length - 8 })}</li>}
                </ul>
              )}
              {previa.avisos.length > 0 && (
                <details class="detalles" open={previa.validos.length === 0}>
                  <summary>{t('calendario.ics.avisos', { n: previa.avisos.length })}</summary>
                  <ul class="cal-lista-simple">
                    {previa.avisos.map((a, i) => (
                      <li key={i}>{textoAviso(a)}</li>
                    ))}
                  </ul>
                </details>
              )}
              {previa.validos.length > 0 && (
                <div class="acciones">
                  <button type="button" class="boton boton--primario" disabled={ocupado} onClick={importar}>
                    {t('calendario.ics.confirmar', { n: previa.validos.length })}
                  </button>
                  <button type="button" class="boton" onClick={() => setPrevia(null)}>
                    {t('calendario.cancelar')}
                  </button>
                </div>
              )}
            </div>
          )}
          <LineaDeAviso aviso={avisoImportar} />
        </div>
      </Seccion>

      <a class="boton" href={hrefDe('/calendario')}>
        {t('calendario.volver')}
      </a>
    </div>
  );
}
