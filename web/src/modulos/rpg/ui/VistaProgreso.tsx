import { useState } from 'preact/hooks';
import type { ContextoDeModulo, PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Seccion, Vacio } from '../../../ui/componentes';
import { ofrecerDeshacer } from '../../../ui/deshacer';
import { useConsulta } from '../../../ui/servicios';
import { oroDisponible, perfilDesdeAlmacen, type AsientoDeExperiencia, type Recompensa, type SemanaEvaluada } from '../aplicacion/almacenes';
import { anularCanje, archivarRecompensa, canjear, crearRecompensa, editarRecompensa, restaurarRecompensa } from '../aplicacion/recompensas';
import { REGLAS_DEL_RPG as REGLAS } from '../dominio/configuracion-activa';
import { progresoPara } from '../dominio/nivel';
import { COSTO_MAX, ErrorDeRecompensa, NOMBRE_MAX } from '../dominio/recompensa';
import { ALMACENES_DE_PROGRESO, etiquetaDeEvento, leerPantalla } from './consultas';
import { ResumenDeProgreso } from './TarjetaProgreso';

function mensajeDeError(t: ContextoDeModulo['t'], e: unknown): string {
  return e instanceof ErrorDeRecompensa ? t(e.clave, e.parametros) : t('rpg.error.inesperado');
}

export function VistaProgreso({ ctx }: PropsDeVista) {
  const { t, formatos } = ctx;
  const hoy = formatos.diaLocal(ctx.reloj.ahora().toISOString());
  const consulta = useConsulta(ctx.almacen, ALMACENES_DE_PROGRESO, (tx) => leerPantalla(tx, hoy));

  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  const d = consulta.datos;
  const perfil = perfilDesdeAlmacen(d.perfil, REGLAS, '');
  const desbloqueados = new Map(d.logros.map((l) => [l.id, l.desbloqueadoEn]));

  return (
    <div class="pila rpg">
      <ResumenDeProgreso ctx={ctx} perfil={d.perfil} activosEstaSemana={d.activosEstaSemana} />

      <Seccion titulo={t('rpg.atributos')}>
        <ul class="rpg-atributos">
          {REGLAS.atributos.map((a) => {
            const xp = perfil.atributos[a] ?? 0;
            const p = progresoPara(xp, REGLAS.nivelDeAtributo);
            const nombre = t(`rpg.atributo.${a}`);
            return (
              <li key={a}>
                <div class="rpg-atributos__fila">
                  <strong>{nombre}</strong>
                  <span class="texto-tenue">{t('rpg.atributo.nivel', { nivel: p.nivel, xp: formatos.numero(xp) })}</span>
                </div>
                <div class="barra-progreso barra-progreso--fina" role="progressbar" aria-valuemin={0} aria-valuemax={p.xpDelTramo} aria-valuenow={p.xpEnNivel} aria-label={t('rpg.atributo.barra', { atributo: nombre, actual: p.xpEnNivel, total: p.xpDelTramo, siguiente: p.nivel + 1 })}>
                  <div class="barra-progreso__relleno" style={{ width: `${Math.round(p.fraccion * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Seccion>

      <Recompensas ctx={ctx} recompensas={d.recompensas} oro={oroDisponible(perfil, REGLAS)} />

      <Seccion titulo={t('rpg.logros')}>
        <p class="texto-tenue">{t('rpg.logros.cuenta', { n: desbloqueados.size, total: REGLAS.logros.length })}</p>
        <ul class="rpg-logros">
          {REGLAS.logros.map((l) => {
            const cuando = desbloqueados.get(l.id);
            return (
              <li key={l.id} class={cuando ? 'rpg-logro rpg-logro--si' : 'rpg-logro'}>
                <span class="rpg-logro__icono" aria-hidden="true">
                  {cuando ? '🏅' : '🔒'}
                </span>
                <div>
                  <strong>{t(`rpg.logro.${l.id}`)}</strong> <span class="texto-tenue">+{l.xp} XP</span>
                  <div class="texto-tenue">{t(`rpg.logro.${l.id}.descripcion`)}</div>
                  <div class="texto-tenue">{cuando ? t('rpg.logros.desbloqueado', { fecha: formatos.fecha(cuando) }) : t('rpg.logros.bloqueado')}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </Seccion>

      <Seccion titulo={t('rpg.racha')}>
        <p class="texto-tenue">{t('rpg.racha.explicacion', { meta: REGLAS.racha.diasActivosPorSemana, cada: REGLAS.racha.semanasPorComodin })}</p>
        {d.semanas.length === 0 ? <Vacio>{t('rpg.racha.sinSemanas')}</Vacio> : <ul class="lista">{d.semanas.map((s) => <FilaDeSemana key={s.lunes} ctx={ctx} s={s} />)}</ul>}
      </Seccion>

      <Seccion titulo={t('rpg.historial')}>
        {d.asientos.length === 0 ? <Vacio>{t('rpg.historialVacio')}</Vacio> : <ul class="lista">{d.asientos.map((a) => <FilaDeAsiento key={a.id} ctx={ctx} a={a} />)}</ul>}
      </Seccion>
    </div>
  );
}

function FilaDeSemana({ ctx, s }: { ctx: ContextoDeModulo; s: SemanaEvaluada }) {
  const { t, formatos } = ctx;
  return (
    <li class="lista__item">
      <strong>{t(`rpg.semana.${s.resultado}`)}</strong>{' '}
      <span class="texto-tenue">
        {t('rpg.semana.de', { fecha: formatos.fecha(`${s.lunes}T12:00:00Z`) })} · {t('rpg.semana.dias', { n: s.diasActivos })} · {t('rpg.racha.semanas', { n: s.despues.semanas })}
        {s.comodinGanado && ` · ${t('rpg.semana.comodinGanado')}`}
      </span>
    </li>
  );
}

function FilaDeAsiento({ ctx, a }: { ctx: ContextoDeModulo; a: AsientoDeExperiencia }) {
  const { t, formatos } = ctx;
  const titulo =
    a.oro !== undefined
      ? a.oro > 0
        ? t('rpg.asiento.oroGastado', { oro: a.oro })
        : t('rpg.asiento.oroDevuelto', { oro: -a.oro })
      : t('rpg.asiento', { xp: a.xp, atributo: t(`rpg.atributo.${a.atributo}`) });
  return (
    <li class="lista__item">
      <strong class={a.anulado ? 'rpg-anulado' : undefined}>{titulo}</strong>{' '}
      <span class="texto-tenue">
        {etiquetaDeEvento(ctx.t, a.tipo)} · {formatos.fechaHora(a.ocurridoEn)}
        {a.nota && ` · ${t(`rpg.nota.${a.nota}`)}`}
        {a.anulado && ` · ${t('rpg.asiento.deshecho')}`}
      </span>
    </li>
  );
}

// ---- R4: recompensas ----

function Recompensas({ ctx, recompensas, oro }: { ctx: ContextoDeModulo; recompensas: Recompensa[]; oro: number }) {
  const { t, formatos } = ctx;
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const activas = recompensas.filter((r) => !r.archivada);
  const archivadas = recompensas.filter((r) => r.archivada);

  const alCanjear = async (r: Recompensa) => {
    try {
      const canje = await canjear(ctx, r.id);
      setAviso(null);
      await ofrecerDeshacer({ mensaje: t('rpg.recompensa.canjeada', { nombre: r.nombre, costo: r.costo }), deshacer: () => anularCanje(ctx, canje) });
    } catch (e) {
      setAviso({ ok: false, texto: mensajeDeError(t, e) });
    }
  };
  const alArchivar = async (r: Recompensa) => {
    try {
      await archivarRecompensa(ctx, r.id);
      await ofrecerDeshacer({ mensaje: t('rpg.recompensa.archivada', { nombre: r.nombre }), deshacer: () => restaurarRecompensa(ctx, r.id).then(() => undefined) });
    } catch (e) {
      setAviso({ ok: false, texto: mensajeDeError(t, e) });
    }
  };

  return (
    <Seccion titulo={t('rpg.recompensas')}>
      <p class="texto-tenue">{t('rpg.recompensas.explicacion', { xpPorOro: REGLAS.oro.xpPorOro })}</p>
      <div role="status" aria-live="polite">
        {aviso && <p class={aviso.ok ? 'aviso' : 'aviso aviso--alerta'}>{aviso.texto}</p>}
      </div>
      {activas.length === 0 ? (
        <Vacio>{t('rpg.recompensas.vacio')}</Vacio>
      ) : (
        <ul class="lista rpg-recompensas">
          {activas.map((r) =>
            editando === r.id ? (
              <li key={r.id} class="lista__item">
                <FormularioDeRecompensa ctx={ctx} inicial={r} alTerminar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={r.id} class="lista__item rpg-recompensa">
                <div class="rpg-recompensa__texto">
                  <strong>{r.nombre}</strong> <span class="oro">{t('rpg.oro', { oro: formatos.numero(r.costo) })}</span>
                  {r.costo > oro && <div class="texto-tenue">{t('rpg.error.oroInsuficiente', { falta: r.costo - oro })}</div>}
                </div>
                <div class="fila rpg-recompensa__acciones">
                  <button type="button" class="boton boton--primario" disabled={r.costo > oro} onClick={() => void alCanjear(r)}>
                    {t('rpg.recompensa.canjear')}
                  </button>
                  <button type="button" class="boton" aria-label={t('rpg.recompensa.editarNombre', { nombre: r.nombre })} onClick={() => setEditando(r.id)}>
                    {t('rpg.recompensa.editar')}
                  </button>
                  <button type="button" class="boton" aria-label={t('rpg.recompensa.archivarNombre', { nombre: r.nombre })} onClick={() => void alArchivar(r)}>
                    {t('rpg.recompensa.archivar')}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <details class="rpg-nueva">
        <summary>{t('rpg.recompensa.nueva')}</summary>
        <FormularioDeRecompensa ctx={ctx} />
      </details>
      {archivadas.length > 0 && (
        <details>
          <summary>{t('rpg.recompensas.archivadas', { n: archivadas.length })}</summary>
          <ul class="lista">
            {archivadas.map((r) => (
              <li key={r.id} class="lista__item rpg-recompensa">
                <span class="rpg-recompensa__texto">
                  {r.nombre} · {t('rpg.oro', { oro: formatos.numero(r.costo) })}
                </span>
                <button type="button" class="boton" onClick={() => void restaurarRecompensa(ctx, r.id)}>
                  {t('rpg.recompensa.restaurar')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Seccion>
  );
}

function FormularioDeRecompensa({ ctx, inicial, alTerminar }: { ctx: ContextoDeModulo; inicial?: Recompensa; alTerminar?: () => void }) {
  const { t } = ctx;
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [costo, setCosto] = useState(inicial ? String(inicial.costo) : '');
  const [errores, setErrores] = useState<{ nombre?: string; costo?: string; general?: string }>({});
  const [guardando, setGuardando] = useState(false);
  const pre = inicial ? `rpg-r-${inicial.id}` : 'rpg-r-nueva';

  const guardar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datos = { nombre, costo: Number(costo) };
      if (inicial) await editarRecompensa(ctx, inicial.id, datos);
      else await crearRecompensa(ctx, datos);
      setErrores({});
      if (!inicial) {
        setNombre('');
        setCosto('');
      }
      alTerminar?.();
    } catch (error) {
      const texto = mensajeDeError(t, error);
      const campo = error instanceof ErrorDeRecompensa ? error.campo : undefined;
      setErrores(campo ? { [campo]: texto } : { general: texto });
      document.getElementById(`${pre}-${campo ?? 'nombre'}`)?.focus();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form class="rpg-formulario" onSubmit={(e) => void guardar(e)} noValidate>
      <div class="campo">
        <label for={`${pre}-nombre`}>{t('rpg.recompensa.nombre')}</label>
        <input id={`${pre}-nombre`} class="control" value={nombre} maxLength={NOMBRE_MAX} placeholder={t('rpg.recompensa.ejemplo')} aria-invalid={errores.nombre ? true : undefined} aria-describedby={errores.nombre ? `${pre}-nombre-error` : undefined} onInput={(e) => setNombre(e.currentTarget.value)} />
        {errores.nombre && (
          <span id={`${pre}-nombre-error`} class="campo__error">
            {errores.nombre}
          </span>
        )}
      </div>
      <div class="campo">
        <label for={`${pre}-costo`}>{t('rpg.recompensa.costo')}</label>
        <input id={`${pre}-costo`} class="control" type="number" inputMode="numeric" min={1} max={COSTO_MAX} step={1} value={costo} aria-invalid={errores.costo ? true : undefined} aria-describedby={errores.costo ? `${pre}-costo-error` : undefined} onInput={(e) => setCosto(e.currentTarget.value)} />
        {errores.costo && (
          <span id={`${pre}-costo-error`} class="campo__error">
            {errores.costo}
          </span>
        )}
      </div>
      {errores.general && <p class="aviso aviso--alerta">{errores.general}</p>}
      <div class="fila">
        <button type="submit" class="boton boton--primario" disabled={guardando}>
          {inicial ? t('rpg.recompensa.guardar') : t('rpg.recompensa.crear')}
        </button>
        {alTerminar && (
          <button type="button" class="boton" onClick={alTerminar}>
            {t('rpg.recompensa.cancelar')}
          </button>
        )}
      </div>
    </form>
  );
}
