/**
 * Raíz de composición: el único lugar que conoce todas las implementaciones
 * concretas y las conecta (inyección de dependencias por constructor).
 */
import './ui/estilos/tokens.css';
import './ui/estilos/base.css';
import './ui/estilos/shell.css';

import { render } from 'preact';
import { MODULOS } from './modulos';
import { BusDeEventos } from './nucleo/aplicacion/bus-de-eventos';
import { RegistroDeModulos } from './nucleo/aplicacion/registro-de-modulos';
import type { ContextoDeModulo } from './nucleo/contrato';
import { GeneradorUuidV7 } from './nucleo/dominio/uuidv7';
import textosDelNucleo from './nucleo/i18n/es-CO.json';
import { crearFormatos, crearTraductor } from './nucleo/i18n/traductor';
import { AlmacenIndexedDb, NUCLEO } from './nucleo/infraestructura/almacen-indexeddb';
import { destinoEnAlmacen, RegistroDeDiagnostico } from './nucleo/infraestructura/diagnostico';
import { aleatorioCriptografico, relojDelSistema } from './nucleo/infraestructura/reloj-del-sistema';
import { registrarServiceWorker, type EstadoDelServiceWorker } from './nucleo/infraestructura/service-worker';
import { aplicarApariencia, leerApariencia } from './ui/apariencia';
import { App, type EstadoDelShell } from './ui/App';
import { RUTAS_DEL_NUCLEO } from './ui/rutas';
import { navegar } from './ui/enrutador';
import { crearSenal } from './ui/senal';
import { ContextoDeServicios, type ServiciosDeApp } from './ui/servicios';

declare const __LUDUS_VERSION__: string;

const NOMBRE_DE_LA_BASE = 'ludus';

async function iniciar(raiz: HTMLElement): Promise<void> {
  aplicarApariencia(leerApariencia());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarApariencia(leerApariencia()));

  const reloj = relojDelSistema;
  const ids = new GeneradorUuidV7(reloj, aleatorioCriptografico);
  const diagnostico = new RegistroDeDiagnostico(reloj, () => ids.siguiente());
  diagnostico.capturarErroresGlobales(window);

  try {
    const registro = new RegistroDeModulos(MODULOS, RUTAS_DEL_NUCLEO);
    const t = crearTraductor({ ...textosDelNucleo, ...registro.textos() }, (clave) =>
      diagnostico.registrar('aviso', 'i18n', `Falta el texto "${clave}"`),
    );
    const formatos = crearFormatos();
    const almacen = await AlmacenIndexedDb.abrir({ nombre: NOMBRE_DE_LA_BASE, esquemas: registro.modulos, reloj, ids });

    const shell: EstadoDelShell = { actualizacion: crearSenal(null), otraVersionAbierta: crearSenal(false) };
    almacen.alCerrarPorOtraVersion = () => shell.otraVersionAbierta.fijar(true);
    await diagnostico.conectar(destinoEnAlmacen(almacen.paraModulo(NUCLEO)));

    const contextos = new Map<string, ContextoDeModulo>();
    const contextoDe = (moduloId: string): ContextoDeModulo => {
      let ctx = contextos.get(moduloId);
      if (!ctx) {
        ctx = {
          moduloId,
          almacen: almacen.paraModulo(moduloId),
          reloj,
          nuevoId: () => ids.siguiente(),
          t,
          formatos,
          diagnostico,
          navegar,
        };
        contextos.set(moduloId, ctx);
      }
      return ctx;
    };

    const bus = new BusDeEventos(almacen, diagnostico, reloj);
    for (const modulo of registro.modulos) {
      for (const suscripcion of modulo.suscripciones?.(contextoDe(modulo.id)) ?? []) bus.registrar(modulo.id, suscripcion);
    }
    await bus.iniciar();

    let estadoSw: EstadoDelServiceWorker = 'registrando';
    registrarServiceWorker(
      (control) => shell.actualizacion.fijar(control),
      (estado, detalle) => {
        estadoSw = estado;
        if (estado === 'error') diagnostico.registrar('aviso', 'service-worker', 'No se pudo registrar; la app no funcionará sin conexión', detalle);
      },
    );

    const servicios: ServiciosDeApp = {
      version: __LUDUS_VERSION__,
      registro,
      almacen,
      bus,
      diagnostico,
      reloj,
      t,
      formatos,
      contextoDe,
      estadoDelServiceWorker: () => estadoSw,
    };

    render(
      <ContextoDeServicios.Provider value={servicios}>
        <App shell={shell} />
      </ContextoDeServicios.Provider>,
      raiz,
    );
  } catch (error) {
    diagnostico.registrar('error', 'arranque', 'Ludus no pudo iniciar', error);
    render(<ErrorDeArranque error={error} />, raiz);
  }
}

/** Pantalla mínima sin dependencias: se muestra si falla el arranque (p. ej. IndexedDB bloqueado). */
function ErrorDeArranque({ error }: { error: unknown }) {
  const detalle = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    <main class="principal arranque-fallido">
      <div class="pila" role="alert">
        <h1 class="titulo-pantalla">{textosDelNucleo['app.errorAlIniciar']}</h1>
        <p>{textosDelNucleo['app.errorAlIniciarAyuda']}</p>
        <pre class="codigo">{detalle}</pre>
      </div>
      <button type="button" class="boton" onClick={() => location.reload()}>
        {textosDelNucleo['app.recargar']}
      </button>
    </main>
  );
}

void iniciar(document.getElementById('app')!);
