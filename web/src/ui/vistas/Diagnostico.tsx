import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { EstadoDeSuscripcion } from '../../nucleo/aplicacion/bus-de-eventos';
import { marcaDeTiempoDe } from '../../nucleo/dominio/uuidv7';
import {
  descargarArchivo,
  detectarCapacidades,
  estadoDelAlmacenamiento,
  type EstadoDelAlmacenamiento,
} from '../../nucleo/infraestructura/plataforma';
import { Cargando, Seccion } from '../componentes';
import { useServicios } from '../servicios';

interface Datos {
  esquemas: Record<string, number>;
  conteos: Record<string, number>;
  suscripciones: EstadoDeSuscripcion[];
  almacenamiento: EstadoDelAlmacenamiento;
}

function Pares({ pares }: { pares: readonly (readonly [string, string])[] }) {
  return (
    <dl class="datos">
      {pares.map(([termino, valor]) => (
        <Fragment key={termino}>
          <dt>{termino}</dt>
          <dd>{valor}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

const megas = (bytes?: number) => (bytes === undefined ? '—' : `${(bytes / 1_048_576).toFixed(1)} MB`);

/** Pantalla "Acerca de / Diagnóstico" (guía §13): todo local, exportable. */
export function Diagnostico() {
  const s = useServicios();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [version, setVersion] = useState(0);
  const [entradas, setEntradas] = useState(() => [...s.diagnostico.todas()]);

  useEffect(() => s.diagnostico.alCambiar(() => setEntradas([...s.diagnostico.todas()])), [s.diagnostico]);
  useEffect(() => s.almacen.escucharCambios('*', () => setVersion((v) => v + 1)), [s.almacen]);
  useEffect(() => {
    let vigente = true;
    Promise.all([s.almacen.versionesDeEsquema(), s.almacen.contarTodo(), s.bus.estado(), estadoDelAlmacenamiento()])
      .then(([esquemas, conteos, suscripciones, almacenamiento]) => {
        if (vigente) setDatos({ esquemas, conteos, suscripciones, almacenamiento });
      })
      .catch((error: unknown) => s.diagnostico.registrar('error', 'diagnostico', 'No se pudo leer el estado', error));
    return () => {
      vigente = false;
    };
  }, [s, version]);

  const siNo = (v: boolean | null) => (v === null ? s.t('diagnostico.desconocido') : s.t(v ? 'diagnostico.si' : 'diagnostico.no'));
  const capacidades = detectarCapacidades();

  const exportar = () => {
    const contenido = { version: s.version, generadoEn: s.reloj.ahora().toISOString(), capacidades, ...datos, entradas };
    descargarArchivo(`ludus-diagnostico-${s.formatos.diaLocal(s.reloj.ahora())}.json`, JSON.stringify(contenido, null, 2));
  };

  return (
    <div class="pila">
      <Seccion titulo={s.t('diagnostico.app')}>
        <dl class="datos">
          <dt>{s.t('diagnostico.version')}</dt>
          <dd>{s.version}</dd>
          <dt>{s.t('diagnostico.serviceWorker')}</dt>
          <dd>{s.estadoDelServiceWorker()}</dd>
        </dl>
      </Seccion>

      {!datos ? (
        <Cargando />
      ) : (
        <>
          <Seccion titulo={s.t('diagnostico.almacenamiento')}>
            <dl class="datos">
              <dt>{s.t('diagnostico.persistente')}</dt>
              <dd>{siNo(datos.almacenamiento.persistente)}</dd>
              <dt>{s.t('diagnostico.uso')}</dt>
              <dd>
                {megas(datos.almacenamiento.usadoBytes)} / {megas(datos.almacenamiento.cuotaBytes)}
              </dd>
            </dl>
          </Seccion>

          <Seccion titulo={s.t('diagnostico.capacidades')}>
            <Pares pares={Object.entries(capacidades).map(([nombre, valor]) => [nombre, siNo(valor)])} />
          </Seccion>

          <Seccion titulo={s.t('diagnostico.modulos')}>
            <Pares pares={Object.entries(datos.esquemas).map(([modulo, v]) => [modulo, `v${v}`])} />
          </Seccion>

          <Seccion titulo={s.t('diagnostico.almacenes')}>
            <Pares pares={Object.entries(datos.conteos).map(([almacen, n]) => [almacen, s.formatos.numero(n)])} />
          </Seccion>

          <Seccion titulo={s.t('diagnostico.suscripciones')}>
            <ul class="lista">
              {datos.suscripciones.map((sus) => (
                <li key={sus.id} class="lista__item">
                  <strong>{sus.id}</strong>{' '}
                  {sus.bloqueo ? (
                    <>
                      <span class="etiqueta etiqueta--alerta">{s.t('diagnostico.enPausa')}</span>
                      <span class="texto-tenue"> {sus.bloqueo.mensaje}</span>{' '}
                      <button type="button" class="boton" onClick={() => s.bus.desbloquear(sus.id).then(() => setVersion((v) => v + 1))}>
                        {s.t('diagnostico.reanudar')}
                      </button>
                    </>
                  ) : (
                    <span class="etiqueta">{s.t('diagnostico.alDia')}</span>
                  )}
                  {sus.ultimoEventoId && (
                    <span class="texto-tenue"> · {s.formatos.fechaHora(new Date(marcaDeTiempoDe(sus.ultimoEventoId)))}</span>
                  )}
                </li>
              ))}
            </ul>
          </Seccion>
        </>
      )}

      <Seccion titulo={s.t('diagnostico.registro')}>
        {entradas.length === 0 ? (
          <p class="texto-tenue">{s.t('diagnostico.sinEntradas')}</p>
        ) : (
          <ol class="lista lista--registro" reversed>
            {[...entradas].reverse().map((e) => (
              <li key={e.id} class="lista__item">
                <span class={`etiqueta ${e.nivel === 'error' ? 'etiqueta--alerta' : ''}`}>{e.nivel}</span>{' '}
                <span class="texto-tenue">{s.formatos.fechaHora(e.instante)} · {e.origen}</span>
                <div>{e.mensaje}</div>
                {e.detalle && (
                  <details>
                    <summary>…</summary>
                    <pre class="codigo">{e.detalle}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
        <button type="button" class="boton" onClick={exportar}>
          {s.t('diagnostico.exportar')}
        </button>
      </Seccion>
    </div>
  );
}
