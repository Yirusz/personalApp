/** E2: duraciones y ciclo; sonido y pantalla encendida. Se aplica desde la próxima fase. */
import { useRef, useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento } from '../../../ui/componentes';
import { hrefDe } from '../../../ui/enrutador';
import { useConsulta } from '../../../ui/servicios';
import { ESTADO, leerEstado } from '../aplicacion/comun';
import { guardarConfiguracion, reiniciarCiclo } from '../aplicacion/pomodoro';
import { LIMITES, type ConfiguracionPomodoro } from '../dominio/configuracion';
import { ErrorDeEstudio } from '../dominio/errores';
import { puedeMantenerPantalla } from '../infraestructura/plataforma';
import { mensajeDeError } from './comun';

type CampoNumerico = keyof typeof LIMITES;
const CAMPOS: CampoNumerico[] = ['focoMin', 'cortoMin', 'largoMin', 'largoCada'];

export function VistaAjustes({ ctx }: PropsDeVista) {
  const consulta = useConsulta(ctx.almacen, [ESTADO], leerEstado);
  if (consulta.estado === 'cargando') return <Cargando />;
  if (consulta.estado === 'error') return <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />;
  return <Formulario ctx={ctx} inicial={consulta.datos.configuracion} />;
}

function Formulario({ ctx, inicial }: { ctx: PropsDeVista['ctx']; inicial: ConfiguracionPomodoro }) {
  const { t } = ctx;
  const [texto, setTexto] = useState<Record<CampoNumerico, string>>(() => Object.fromEntries(CAMPOS.map((c) => [c, String(inicial[c])])) as Record<CampoNumerico, string>);
  const [sonido, setSonido] = useState(inicial.sonido);
  const [pantalla, setPantalla] = useState(inicial.pantallaEncendida);
  const [errores, setErrores] = useState<Partial<Record<CampoNumerico, string>>>({});
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  const guardar = async (e: Event) => {
    e.preventDefault();
    setAviso(null);
    // Se revisan todos los campos a la vez (el dominio vuelve a validar).
    const nuevos: Partial<Record<CampoNumerico, string>> = {};
    for (const c of CAMPOS) {
      const n = Number(texto[c]);
      if (!Number.isInteger(n) || n < LIMITES[c].min || n > LIMITES[c].max) nuevos[c] = t(`estudio.error.${c}`, LIMITES[c]);
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) {
      queueMicrotask(() => formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    try {
      await guardarConfiguracion(ctx, { focoMin: Number(texto.focoMin), cortoMin: Number(texto.cortoMin), largoMin: Number(texto.largoMin), largoCada: Number(texto.largoCada), sonido, pantallaEncendida: pantalla });
      setAviso({ ok: true, texto: t('estudio.guardado') });
    } catch (error) {
      if (error instanceof ErrorDeEstudio && error.campo && error.campo in LIMITES) setErrores({ [error.campo]: mensajeDeError(t, error) });
      else setAviso({ ok: false, texto: mensajeDeError(t, error) });
    }
  };

  return (
    <form ref={formulario} class="tarjeta pila" onSubmit={guardar} noValidate>
      <div class="est-campos">
        {CAMPOS.map((c) => (
          <div key={c} class="campo">
            <label for={`estudio-${c}`}>{t(`estudio.campo.${c}`)}</label>
            <input
              id={`estudio-${c}`}
              type="number"
              inputMode="numeric"
              min={LIMITES[c].min}
              max={LIMITES[c].max}
              step={1}
              value={texto[c]}
              aria-invalid={errores[c] ? 'true' : undefined}
              aria-describedby={`estudio-${c}-ayuda${errores[c] ? ` estudio-${c}-error` : ''}`}
              onInput={(e) => {
                setTexto({ ...texto, [c]: (e.currentTarget as HTMLInputElement).value });
                setErrores({ ...errores, [c]: undefined });
              }}
            />
            <span id={`estudio-${c}-ayuda`} class="campo__ayuda">
              {t('estudio.campo.rango', LIMITES[c])}
            </span>
            {errores[c] && (
              <span id={`estudio-${c}-error`} class="campo__error">
                {errores[c]}
              </span>
            )}
          </div>
        ))}
      </div>
      <label class="opcion">
        <input type="checkbox" checked={sonido} onChange={(e) => setSonido((e.currentTarget as HTMLInputElement).checked)} />
        🔔 {t('estudio.campo.sonido')}
      </label>
      {puedeMantenerPantalla() ? (
        <label class="opcion">
          <input type="checkbox" checked={pantalla} onChange={(e) => setPantalla((e.currentTarget as HTMLInputElement).checked)} />
          ☀ {t('estudio.campo.pantalla')}
        </label>
      ) : (
        <p class="campo__ayuda">{t('estudio.campo.pantallaNoDisponible')}</p>
      )}
      <div class="acciones">
        <button type="submit" class="boton boton--primario">
          {t('estudio.guardar')}
        </button>
        <button
          type="button"
          class="boton"
          onClick={async () => {
            await reiniciarCiclo(ctx);
            setAviso({ ok: true, texto: t('estudio.cicloReiniciado') });
          }}
        >
          {t('estudio.reiniciarCiclo')}
        </button>
        <a class="boton" href={hrefDe('/estudio')}>
          {t('estudio.volver')}
        </a>
      </div>
      <div role="status" aria-live="polite">
        {aviso && <p class={aviso.ok ? 'aviso' : 'aviso aviso--alerta'}>{aviso.texto}</p>}
      </div>
    </form>
  );
}
