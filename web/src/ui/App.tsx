/**
 * Shell de Ludus: navegación adaptativa (barra inferior en pantallas angostas,
 * riel lateral en anchas), avisos globales y salida de las pantallas.
 */
import type { ComponentType, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ControlDeActualizacion } from '../nucleo/infraestructura/service-worker';
import { Icono, VistaDiferida } from './componentes';
import { BarraDeshacer } from './deshacer';
import { coincidir, hrefDe, navegar, useRuta } from './enrutador';
import { ICONOS } from './iconos';
import type { Senal } from './senal';
import { useSenal } from './senal';
import { useEnLinea, useServicios } from './servicios';
import { Ajustes } from './vistas/Ajustes';
import { Diagnostico } from './vistas/Diagnostico';
import { Inicio } from './vistas/Inicio';
import { Mas } from './vistas/Mas';
import { NoEncontrada } from './vistas/NoEncontrada';

export { RUTAS_DEL_NUCLEO } from './rutas';

const MAX_EN_BARRA = 5;
const CONSULTA_ANCHA = '(min-width: 720px)';

export interface ElementoDeNavegacion {
  ruta: string;
  etiqueta: string;
  icono: string;
}

export interface EstadoDelShell {
  actualizacion: Senal<ControlDeActualizacion | null>;
  otraVersionAbierta: Senal<boolean>;
}

function useEsAncho(): boolean {
  const [ancho, setAncho] = useState(() => matchMedia(CONSULTA_ANCHA).matches);
  useEffect(() => {
    const mq = matchMedia(CONSULTA_ANCHA);
    const alCambiar = () => setAncho(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return ancho;
}

interface Resuelta {
  titulo: string;
  render: () => JSX.Element;
}

export function App({ shell }: { shell: EstadoDelShell }) {
  const s = useServicios();
  const ruta = useRuta();
  const enLinea = useEnLinea();
  const esAncho = useEsAncho();
  const actualizacion = useSenal(shell.actualizacion);
  const otraVersion = useSenal(shell.otraVersionAbierta);
  const principal = useRef<HTMLElement>(null);
  const primerRender = useRef(true);

  const elementos = useMemo<ElementoDeNavegacion[]>(
    () => [
      { ruta: '/', etiqueta: 'inicio.titulo', icono: ICONOS.inicio },
      ...s.registro.navegacion().map((n) => ({ ruta: n.ruta, etiqueta: n.etiqueta, icono: n.icono })),
      { ruta: '/ajustes', etiqueta: 'ajustes.titulo', icono: ICONOS.ajustes },
    ],
    [s.registro],
  );
  const enBarra =
    esAncho || elementos.length <= MAX_EN_BARRA
      ? elementos
      : [...elementos.slice(0, MAX_EN_BARRA - 1), { ruta: '/mas', etiqueta: 'mas.titulo', icono: ICONOS.mas }];
  const desbordados = elementos.filter((e) => !enBarra.includes(e));

  const resuelta = useMemo<Resuelta>(() => {
    const delNucleo: Record<string, Resuelta> = {
      '/': { titulo: 'inicio.titulo', render: () => <Inicio /> },
      '/ajustes': { titulo: 'ajustes.titulo', render: () => <Ajustes /> },
      '/diagnostico': { titulo: 'diagnostico.titulo', render: () => <Diagnostico /> },
      '/mas': { titulo: 'mas.titulo', render: () => <Mas elementos={desbordados} /> },
    };
    const rutaSinConsulta = ruta.split('?')[0]!;
    if (delNucleo[rutaSinConsulta]) return delNucleo[rutaSinConsulta]!;
    for (const r of s.registro.rutas()) {
      const params = coincidir(r.patron, ruta);
      if (params) {
        const ctx = s.contextoDe(r.moduloId);
        return {
          titulo: r.titulo,
          render: () => <VistaDiferida key={r.patron} cargar={r.vista as () => Promise<ComponentType<object>>} props={{ ctx, params }} />,
        };
      }
    }
    return { titulo: 'app.noEncontrada', render: () => <NoEncontrada /> };
    // `desbordados` deriva de `esAncho`.
  }, [ruta, s, esAncho]);

  const titulo = s.t(resuelta.titulo);
  useEffect(() => {
    document.title = `${titulo} · ${s.t('app.nombre')}`;
    // Al cambiar de pantalla, el foco va al título (lectores de pantalla y teclado).
    if (primerRender.current) primerRender.current = false;
    else principal.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [ruta, titulo]);

  const activa = (r: string) => (r === '/' ? ruta === '/' : ruta === r || ruta.startsWith(`${r}/`));

  return (
    <div class="shell">
      <a
        class="saltar"
        href={hrefDe(ruta)}
        onClick={(e) => {
          e.preventDefault();
          principal.current?.focus();
        }}
      >
        {s.t('app.saltarAlContenido')}
      </a>

      <nav class="nav" aria-label={s.t('app.navegacion')}>
        <span class="nav__marca" aria-hidden="true">
          {s.t('app.nombre')}
        </span>
        <ul class="nav__lista">
          {enBarra.map((e) => (
            <li key={e.ruta}>
              <a
                class="nav__enlace"
                href={hrefDe(e.ruta)}
                aria-current={activa(e.ruta) || (e.ruta === '/mas' && desbordados.some((d) => activa(d.ruta))) ? 'page' : undefined}
              >
                <Icono d={e.icono} />
                <span class="nav__texto">{s.t(e.etiqueta)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main id="contenido" class="principal" ref={principal} tabIndex={-1}>
        {otraVersion && (
          <div class="aviso aviso--alerta" role="alert">
            <span>{s.t('app.otraVersionAbierta')}</span>
            <button type="button" class="boton" onClick={() => location.reload()}>
              {s.t('app.recargar')}
            </button>
          </div>
        )}
        {actualizacion && (
          <div class="aviso" role="status">
            <span>{s.t('app.actualizacionDisponible')}</span>
            <button type="button" class="boton boton--primario" onClick={() => actualizacion.aplicar()}>
              {s.t('app.actualizar')}
            </button>
          </div>
        )}
        {!enLinea && (
          <div class="aviso aviso--tenue" role="status">
            {s.t('app.sinConexion')}
          </div>
        )}
        <h1 class="titulo-pantalla" tabIndex={-1}>
          {titulo}
        </h1>
        {resuelta.render()}
      </main>
      <BarraDeshacer />
    </div>
  );
}

export { navegar };
