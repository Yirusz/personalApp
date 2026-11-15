import { useState } from 'preact/hooks';
import type { PropsDeVista } from '../../../nucleo/contrato';
import { Cargando, ErrorConReintento, Vacio } from '../../../ui/componentes';
import { useConsulta } from '../../../ui/servicios';
import { ALMACEN, leerRecientes, registrar } from '../aplicacion/registrar';
import { LONGITUD_MAXIMA } from '../dominio/registro';

export function VistaEjemplo({ ctx }: PropsDeVista) {
  const { t, formatos } = ctx;
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const consulta = useConsulta(ctx.almacen, [ALMACEN], (tx) => leerRecientes(tx));

  const enviar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await registrar(ctx, texto);
      setTexto('');
      setMensaje({ ok: true, texto: t('ejemplo.registrado') });
    } catch (error) {
      setMensaje({ ok: false, texto: error instanceof Error ? error.message : String(error) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div class="pila">
      <p class="texto-tenue">{t('ejemplo.descripcion')}</p>

      <form class="tarjeta" onSubmit={enviar}>
        <label class="campo">
          <span>{t('ejemplo.campo')}</span>
          <input
            value={texto}
            maxLength={LONGITUD_MAXIMA}
            onInput={(e) => setTexto((e.currentTarget as HTMLInputElement).value)}
            aria-describedby="ejemplo-ayuda"
          />
          <span id="ejemplo-ayuda" class="campo__ayuda">
            {t('ejemplo.ayuda', { max: LONGITUD_MAXIMA })}
          </span>
        </label>
        <div class="acciones">
          <button class="boton boton--primario" type="submit" disabled={guardando}>
            {t('ejemplo.registrar')}
          </button>
        </div>
        {mensaje && (
          <p class={mensaje.ok ? 'aviso' : 'aviso aviso--alerta'} role={mensaje.ok ? 'status' : 'alert'}>
            {mensaje.texto}
          </p>
        )}
      </form>

      <section class="seccion">
        <h2 class="seccion__titulo">{t('ejemplo.recientes')}</h2>
        {consulta.estado === 'cargando' && <Cargando />}
        {consulta.estado === 'error' && <ErrorConReintento error={consulta.error} reintentar={consulta.reintentar} />}
        {consulta.estado === 'listo' &&
          (consulta.datos.length === 0 ? (
            <Vacio>{t('ejemplo.vacio')}</Vacio>
          ) : (
            <ul class="lista">
              {consulta.datos.map((r) => (
                <li key={r.id} class="lista__item">
                  <div>{r.texto || <span class="texto-tenue">{t('ejemplo.sinTexto')}</span>}</div>
                  <time class="texto-tenue" dateTime={r.creadoEn}>
                    {formatos.fechaHora(r.creadoEn)}
                  </time>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
