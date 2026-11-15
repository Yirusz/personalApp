import { useEffect, useRef, useState } from 'preact/hooks';
import { crearRespaldo, leerRespaldo, nombreDeArchivo, restaurarRespaldo, type Respaldo } from '../../nucleo/aplicacion/respaldo';
import {
  descargarArchivo,
  estadoDelAlmacenamiento,
  leerArchivoComoTexto,
  pedirAlmacenamientoPersistente,
} from '../../nucleo/infraestructura/plataforma';
import { guardarApariencia, leerApariencia, type Esquema } from '../apariencia';
import { Icono, Seccion } from '../componentes';
import { hrefDe } from '../enrutador';
import { ICONOS } from '../iconos';
import { useConsulta, useServicios } from '../servicios';

interface Ajuste<T> {
  clave: string;
  valor: T;
}

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

export function Ajustes() {
  const s = useServicios();
  const nucleo = s.contextoDe('nucleo').almacen;
  const [apariencia, setApariencia] = useState(leerApariencia);
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [pendiente, setPendiente] = useState<Respaldo | null>(null);
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const selector = useRef<HTMLInputElement>(null);

  const ultimo = useConsulta(nucleo, ['ajustes'], (tx) => tx.obtener<Ajuste<string>>('ajustes', 'ultimoRespaldo'));

  useEffect(() => {
    estadoDelAlmacenamiento()
      .then((e) => setPersistente(e.persistente))
      .catch(() => setPersistente(null));
  }, []);

  useEffect(() => {
    if (pendiente) dialogo.current?.showModal();
    else dialogo.current?.close();
  }, [pendiente]);

  const cambiarEsquema = (esquema: Esquema) => {
    const nueva = { ...apariencia, esquema };
    setApariencia(nueva);
    guardarApariencia(nueva);
  };

  // Firefox/Zen muestran un permiso al pedir persistencia: solo se pide tras una acción del usuario.
  const proteger = async () => {
    setPersistente(await pedirAlmacenamientoPersistente().catch(() => null));
  };

  const exportar = async () => {
    void proteger();
    try {
      const respaldo = await crearRespaldo(s.almacen, s.reloj, s.version);
      const archivo = nombreDeArchivo(respaldo);
      descargarArchivo(archivo, JSON.stringify(respaldo));
      await nucleo.escribir(['ajustes'], (tx) =>
        tx.poner<Ajuste<string>>('ajustes', { clave: 'ultimoRespaldo', valor: respaldo.exportadoEn }),
      );
      setMensaje({ tipo: 'ok', texto: s.t('ajustes.exportadoOk', { archivo }) });
    } catch (error) {
      s.diagnostico.registrar('error', 'respaldo', 'No se pudo exportar', error);
      setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : String(error) });
    }
  };

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const texto = await leerArchivoComoTexto(archivo);
      setPendiente(leerRespaldo(texto, await s.almacen.versionesDeEsquema(), s.almacen.nombresDeAlmacenes()));
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : String(error) });
    } finally {
      if (selector.current) selector.current.value = '';
    }
  };

  const importar = async () => {
    const respaldo = pendiente;
    setPendiente(null);
    if (!respaldo) return;
    try {
      await restaurarRespaldo(s.almacen, respaldo);
      await s.bus.procesarPendientes();
      setMensaje({ tipo: 'ok', texto: s.t('ajustes.importadoOk', { fecha: s.formatos.fechaHora(respaldo.exportadoEn) }) });
    } catch (error) {
      s.diagnostico.registrar('error', 'respaldo', 'No se pudo importar', error);
      setMensaje({ tipo: 'error', texto: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div class="pila">
      <Seccion titulo={s.t('ajustes.apariencia')}>
        <fieldset class="grupo">
          <legend>{s.t('ajustes.esquema')}</legend>
          {(['sistema', 'claro', 'oscuro'] as const).map((e) => (
            <label key={e} class="opcion">
              <input type="radio" name="esquema" checked={apariencia.esquema === e} onChange={() => cambiarEsquema(e)} />
              {s.t(`ajustes.esquema.${e}`)}
            </label>
          ))}
        </fieldset>
        <fieldset class="grupo">
          <legend>{s.t('ajustes.estilo')}</legend>
          <label class="opcion">
            <input type="radio" name="estilo" checked readOnly />
            {s.t('ajustes.estilo.minimal')}
          </label>
          <label class="opcion opcion--desactivada">
            <input type="radio" name="estilo" disabled />
            {s.t('ajustes.estilo.pixel')}
          </label>
        </fieldset>
      </Seccion>

      <Seccion titulo={s.t('ajustes.datos')}>
        <p>{s.t('ajustes.datosAyuda')}</p>
        {persistente !== null && (
          <div class={persistente ? 'texto-tenue' : 'aviso aviso--alerta'}>
            <span>{s.t(persistente ? 'ajustes.persistente.si' : 'ajustes.persistente.no')}</span>
            {!persistente && (
              <button type="button" class="boton" onClick={proteger}>
                {s.t('ajustes.proteger')}
              </button>
            )}
          </div>
        )}
        <p class="texto-tenue">
          {ultimo.estado === 'listo' && ultimo.datos
            ? s.t('ajustes.ultimoRespaldo', { fecha: s.formatos.fechaHora(ultimo.datos.valor) })
            : s.t('ajustes.nuncaRespaldo')}
        </p>
        <div class="acciones">
          <button type="button" class="boton boton--primario" onClick={exportar}>
            <Icono d={ICONOS.descargar} />
            {s.t('ajustes.exportar')}
          </button>
          <label class="boton">
            <Icono d={ICONOS.subir} />
            {s.t('ajustes.importar')}
            <input
              ref={selector}
              class="oculto-visualmente"
              type="file"
              accept="application/json,.json"
              onChange={(e) => elegirArchivo((e.currentTarget as HTMLInputElement).files?.[0])}
            />
          </label>
        </div>
        {mensaje && (
          <p class={mensaje.tipo === 'ok' ? 'aviso' : 'aviso aviso--alerta'} role={mensaje.tipo === 'ok' ? 'status' : 'alert'}>
            {mensaje.texto}
          </p>
        )}
      </Seccion>

      <Seccion titulo={s.t('ajustes.diagnostico')}>
        <p>
          <a class="boton" href={hrefDe('/diagnostico')}>
            {s.t('diagnostico.titulo')}
          </a>
        </p>
        <p class="texto-tenue">{s.t('ajustes.version', { version: s.version })}</p>
      </Seccion>

      <dialog ref={dialogo} class="dialogo" onClose={() => setPendiente(null)}>
        <p>{s.t('ajustes.importarAdvertencia')}</p>
        <div class="acciones">
          <button type="button" class="boton" onClick={() => setPendiente(null)}>
            {s.t('ajustes.importarCancelar')}
          </button>
          <button type="button" class="boton boton--peligro" onClick={importar}>
            {s.t('ajustes.importarConfirmar')}
          </button>
        </div>
      </dialog>
    </div>
  );
}
