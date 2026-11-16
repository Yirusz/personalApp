/**
 * E1–E5: temporizador Pomodoro (el tiempo sale del Reloj; el tic solo repinta), vínculo
 * con materia o trabajo por consulta, aviso y garantías, y estadísticas de hoy y la semana.
 * El botón principal queda abajo en el teléfono (zona del pulgar).
 */
import { useEffect, useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import type { Vinculo } from '../../../nucleo/dominio/fichas';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { zonaDelUsuario } from '../aplicacion/comun';
import { ALMACENES_DE_ESTUDIO, leerPantalla } from '../aplicacion/consultas';
import { cambiarVinculo, detener, iniciarFase, pausar, reanudar } from '../aplicacion/pomodoro';
import { textoRestante } from '../aplicacion/temporizador';
import type { Resumen } from '../dominio/estadisticas';
import { estaPausada, FASES, finPrevistoMs, restanteMs, type Fase, type SesionActiva } from '../dominio/sesion';
import { liberarPantalla, mantenerPantalla, prepararAudio, puedeMantenerPantalla } from '../infraestructura/plataforma';
import { claveDeVinculo, mensajeDeError, nombreDeVinculo, textoDeMinutos, useNombres, useOpciones, useTic, vinculoDeClave, type Nombres } from './comun';

const hoyCivil = (ctx: ContextoDeModulo) => zonaDelUsuario().aCivil(ctx.reloj.ahora().getTime()).fecha;

export function VistaEstudio({ ctx }: PropsDeVista) {
  const { t } = ctx;
  const hoy = hoyCivil(ctx);
  const consulta = useConsulta(ctx.almacen, ALMACENES_DE_ESTUDIO, (tx) => leerPantalla(tx, hoy));
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const datos = consulta.estado === 'listo' ? consulta.datos : null;
  const activa = datos?.activa ?? null;
  const corriendo = !!activa && !estaPausada(activa);
  const ahora = useTic(ctx, corriendo);
  const nombres = useNombres(ctx, [activa?.vinculo ?? null, vinculo, ...(datos?.resumen.semana.porVinculo.map((p) => p.vinculo) ?? [])]);

  // Pantalla encendida (opcional): solo mientras corre y la pantalla está a la vista.
  const conPantalla = !!datos?.configuracion.pantallaEncendida && corriendo;
  useEffect(() => {
    if (!conPantalla) {
      liberarPantalla();
      return;
    }
    void mantenerPantalla();
    const alVolver = () => document.visibilityState === 'visible' && void mantenerPantalla();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      liberarPantalla();
    };
  }, [conPantalla]);

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const d = datos!;

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeError(t, e));
      if (consulta.estado === 'listo') consulta.recargar(); // p. ej. otra pestaña ya cambió la sesión
    } finally {
      setOcupado(false);
    }
  };
  const iniciar = (fase?: Fase) => {
    prepararAudio(); // gesto del usuario: el navegador permite el tono al terminar
    void ejecutar(() => iniciarFase(ctx, { vinculo, fase }));
  };

  return (
    <div class="pila est">
      <Reloj
        ctx={ctx}
        activa={activa}
        ahora={ahora}
        proxima={d.ciclo.proxima}
        duracionProxima={d.ciclo.proxima === 'foco' ? d.configuracion.focoMin : d.ciclo.proxima === 'corto' ? d.configuracion.cortoMin : d.configuracion.largoMin}
        focosEnCiclo={d.ciclo.focosEnCiclo}
        largoCada={d.configuracion.largoCada}
      >
        <CampoDeVinculo
          ctx={ctx}
          valor={activa ? activa.vinculo : vinculo}
          nombres={nombres}
          deshabilitado={!!activa && activa.fase !== 'foco'}
          visible={activa ? activa.fase === 'foco' : d.ciclo.proxima === 'foco'}
          cambiar={(v) => (activa ? void ejecutar(() => cambiarVinculo(ctx, v)) : setVinculo(v))}
        />
        <div class="est-acciones" role="group" aria-label={t('estudio.acciones')}>
          {!activa ? (
            <button type="button" class="boton boton--primario est-principal" disabled={ocupado} onClick={() => iniciar()}>
              ▶ {t('estudio.iniciar', { fase: t(`estudio.fase.${d.ciclo.proxima}`).toLowerCase() })}
            </button>
          ) : estaPausada(activa) ? (
            <button
              type="button"
              class="boton boton--primario est-principal"
              disabled={ocupado}
              onClick={() => {
                prepararAudio();
                void ejecutar(() => reanudar(ctx));
              }}
            >
              ▶ {t('estudio.reanudar')}
            </button>
          ) : (
            <button type="button" class="boton boton--primario est-principal" disabled={ocupado} onClick={() => void ejecutar(() => pausar(ctx))}>
              ❚❚ {t('estudio.pausar')}
            </button>
          )}
          {activa && (
            <button type="button" class="boton" disabled={ocupado} onClick={() => void ejecutar(() => detener(ctx))}>
              {activa.fase === 'foco' ? `■ ${t('estudio.detenerFoco')}` : `⏭ ${t('estudio.saltar')}`}
            </button>
          )}
        </div>
        {activa?.fase === 'foco' && <p class="campo__ayuda">{t('estudio.detenerFocoAyuda')}</p>}
        <div role="status" aria-live="polite">
          {error && <p class="aviso aviso--alerta">{error}</p>}
          {!activa && d.ciclo.ultima && <UltimaFase ctx={ctx} ultima={d.ciclo.ultima} />}
        </div>
        {!activa && (
          <details class="detalles">
            <summary>{t('estudio.cambiarFase')}</summary>
            <div class="acciones">
              {FASES.filter((f) => f !== d.ciclo.proxima).map((f) => (
                <button key={f} type="button" class="boton" disabled={ocupado} onClick={() => iniciar(f)}>
                  {t('estudio.iniciar', { fase: t(`estudio.fase.${f}`).toLowerCase() })}
                </button>
              ))}
            </div>
          </details>
        )}
      </Reloj>

      <Garantias ctx={ctx} />

      <Estadisticas ctx={ctx} resumen={d.resumen} nombres={nombres} hoy={hoy} alEmpezar={!activa ? () => iniciar('foco') : undefined} />

      <a class="boton" href={hrefDe('/estudio/ajustes')}>
        ⚙ {t('estudio.ajustes')}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Temporizador
// ---------------------------------------------------------------------------

const RADIO = 54;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

function Reloj({
  ctx,
  activa,
  ahora,
  proxima,
  duracionProxima,
  focosEnCiclo,
  largoCada,
  children,
}: {
  ctx: ContextoDeModulo;
  activa: SesionActiva | null;
  ahora: number;
  proxima: Fase;
  duracionProxima: number;
  focosEnCiclo: number;
  largoCada: number;
  children: preact.ComponentChildren;
}) {
  const { t } = ctx;
  const fase = activa?.fase ?? proxima;
  const totalMs = (activa?.duracionMin ?? duracionProxima) * 60_000;
  const restante = activa ? restanteMs(activa, ahora) : totalMs;
  const avance = activa ? Math.min(1, 1 - restante / totalMs) : 0;
  const pausada = !!activa && estaPausada(activa);
  const nFoco = Math.min(largoCada, focosEnCiclo + (fase === 'foco' ? 1 : 0));
  return (
    <section class="tarjeta est-reloj" data-fase={fase} aria-labelledby="est-fase">
      <h2 id="est-fase" class="est-fase">
        {t(`estudio.fase.${fase}`)}
        {pausada && <span class="etiqueta">{t('estudio.enPausa')}</span>}
      </h2>
      <div class="est-circulo">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="est-circulo__fondo" cx="60" cy="60" r={RADIO} />
          <circle class="est-circulo__avance" cx="60" cy="60" r={RADIO} style={{ strokeDasharray: CIRCUNFERENCIA, strokeDashoffset: CIRCUNFERENCIA * (1 - avance) }} />
        </svg>
        {/* El lector de pantalla no anuncia cada segundo; se consulta al enfocar. */}
        <p class="est-tiempo" role="timer" aria-live="off" aria-label={t('estudio.restante', { tiempo: textoRestante(restante) })}>
          {textoRestante(restante)}
        </p>
      </div>
      <p class="texto-tenue est-detalle">
        {activa
          ? pausada
            ? t('estudio.enPausa')
            : t('estudio.terminaA', { hora: ctx.formatos.hora(new Date(finPrevistoMs(activa, ahora))) })
          : t('estudio.proxima', { fase: t(`estudio.fase.${proxima}`).toLowerCase(), n: duracionProxima })}
        {fase === 'foco' && ` · ${t('estudio.ciclo', { n: nFoco, total: largoCada })}`}
      </p>
      {children}
    </section>
  );
}

function UltimaFase({ ctx, ultima }: { ctx: ContextoDeModulo; ultima: { fase: Fase; estado: string; finalizadaEn: string } }) {
  const hora = ctx.formatos.hora(new Date(ultima.finalizadaEn));
  const texto =
    ultima.estado === 'completada'
      ? ctx.t('estudio.ultima.completada', { fase: ctx.t(`estudio.fase.${ultima.fase}`), hora })
      : ultima.estado === 'interrumpida'
        ? ctx.t('estudio.ultima.interrumpida', { hora })
        : ctx.t('estudio.ultima.saltada');
  return <p class={ultima.estado === 'completada' ? 'aviso' : 'texto-tenue'}>{texto}</p>;
}

function CampoDeVinculo({
  ctx,
  valor,
  nombres,
  deshabilitado,
  visible,
  cambiar,
}: {
  ctx: ContextoDeModulo;
  valor: Vinculo | null;
  nombres: Nombres;
  deshabilitado: boolean;
  visible: boolean;
  cambiar: (v: Vinculo | null) => void;
}) {
  const { t } = ctx;
  const opciones = useOpciones(ctx);
  if (!visible) return null;
  const actual = valor ? claveDeVinculo(valor) : '';
  const enLista = opciones?.some((g) => g.referencias.some((r) => claveDeVinculo(r) === actual)) ?? false;
  return (
    <div class="campo est-vinculo">
      <label for="estudio-vinculo">{t('estudio.vinculo')}</label>
      <select id="estudio-vinculo" value={actual} disabled={deshabilitado || !opciones} onChange={(e) => cambiar(vinculoDeClave((e.currentTarget as HTMLSelectElement).value))}>
        <option value="">{t('estudio.vinculoNinguno')}</option>
        {/* Un vínculo que ya no está en la lista (archivado, borrado o Universidad caída) se sigue mostrando. */}
        {valor && !enLista && <option value={actual}>{nombreDeVinculo(t, valor, nombres)}</option>}
        {opciones?.map((g) => (
          <optgroup key={g.tipo} label={t(`estudio.tipo.${g.tipo}`)}>
            {g.referencias.map((r) => (
              <option key={r.id} value={claveDeVinculo(r)}>
                {r.titulo}
                {r.detalle ? ` · ${r.detalle}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// E3: qué garantiza el aviso
// ---------------------------------------------------------------------------

function Garantias({ ctx }: { ctx: ContextoDeModulo }) {
  const { t } = ctx;
  const [permiso, setPermiso] = useState(() => ctx.notificaciones.permiso());
  return (
    <details class="detalles est-garantias">
      <summary>{t('estudio.garantias.titulo')}</summary>
      <ul class="est-lista-simple">
        <li>{t('estudio.garantias.abierta')}</li>
        <li>{t('estudio.garantias.cerrada')}</li>
        {puedeMantenerPantalla() && <li>{t('estudio.garantias.pantalla')}</li>}
      </ul>
      {permiso === 'preguntar' && (
        <button type="button" class="boton" onClick={async () => setPermiso(await ctx.notificaciones.pedirPermiso())}>
          🔔 {t('estudio.permiso.preguntar')}
        </button>
      )}
      {permiso === 'denegado' && <p class="aviso aviso--alerta">{t('estudio.permiso.denegado')}</p>}
    </details>
  );
}

// ---------------------------------------------------------------------------
// E4: estadísticas (barras propias, sin bibliotecas)
// ---------------------------------------------------------------------------

const fmtDia = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short' });
const diaCorto = (f: string) => fmtDia.format(new Date(`${f}T12:00:00Z`)).replace('.', '');

function Estadisticas({ ctx, resumen, nombres, hoy, alEmpezar }: { ctx: ContextoDeModulo; resumen: Resumen; nombres: Nombres; hoy: string; alEmpezar?: () => void }) {
  const { t } = ctx;
  if (resumen.semana.minutos === 0) {
    return (
      <Seccion titulo={t('estudio.estadisticas')}>
        <div class="pila">
          <Vacio>{t('estudio.vacio')}</Vacio>
          {alEmpezar && (
            <button type="button" class="boton boton--primario" onClick={alEmpezar}>
              {t('estudio.empezar')}
            </button>
          )}
        </div>
      </Seccion>
    );
  }
  const maxDia = Math.max(...resumen.semana.dias.map((d) => d.minutos), 1);
  const maxVinculo = Math.max(...resumen.semana.porVinculo.map((p) => p.minutos), 1);
  return (
    <Seccion titulo={t('estudio.estadisticas')}>
      <div class="est-cifras">
        <div class="tarjeta">
          <p class="texto-tenue">{t('estudio.hoy')}</p>
          <p class="est-cifra">{textoDeMinutos(t, resumen.hoy.minutos)}</p>
          <p class="texto-tenue">{t('estudio.pomodoros', { n: resumen.hoy.pomodoros })}</p>
        </div>
        <div class="tarjeta">
          <p class="texto-tenue">{t('estudio.semana')}</p>
          <p class="est-cifra">{textoDeMinutos(t, resumen.semana.minutos)}</p>
        </div>
      </div>

      <div class="tarjeta pila">
        <h3 class="est-subtitulo">{t('estudio.porDia')}</h3>
        <ul class="est-semana">
          {resumen.semana.dias.map((d) => (
            <li key={d.fecha} class={d.fecha === hoy ? 'est-semana__dia est-semana__dia--hoy' : 'est-semana__dia'} aria-label={t('estudio.diaBarra', { dia: diaCorto(d.fecha), tiempo: textoDeMinutos(t, d.minutos) })}>
              <span class="est-semana__valor" aria-hidden="true">
                {d.minutos > 0 ? d.minutos : ''}
              </span>
              <span class="est-semana__barra" style={{ '--alto': d.minutos / maxDia }} aria-hidden="true" />
              <span class="est-semana__etiqueta" aria-hidden="true">
                {diaCorto(d.fecha)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div class="tarjeta pila">
        <h3 class="est-subtitulo">{t('estudio.porVinculo')}</h3>
        <ul class="est-reparto">
          {resumen.semana.porVinculo.map((p) => {
            const ref = p.vinculo ? nombres.porClave.get(claveDeVinculo(p.vinculo)) : undefined;
            return (
              <li key={p.vinculo ? claveDeVinculo(p.vinculo) : '-'} data-color={ref?.color}>
                <span class="est-reparto__nombre">
                  <span class="marca-color" aria-hidden="true" />
                  {nombreDeVinculo(t, p.vinculo, nombres)}
                </span>
                <span class="est-reparto__barra" style={{ '--ancho': p.minutos / maxVinculo }} aria-hidden="true" />
                <span class="est-reparto__valor">{textoDeMinutos(t, p.minutos)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Seccion>
  );
}
