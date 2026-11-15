import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const raiz = fileURLToPath(new URL('.', import.meta.url));
const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as { version: string };

/** Lista recursiva de archivos de `public/` con separador `/` (igual en Windows y Linux). */
function archivosPublicos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivosPublicos(ruta));
    else salida.push(relative(join(raiz, 'public'), ruta).split(sep).join('/'));
  }
  return salida;
}

/**
 * Genera `sw.js` en el build a partir de `src/sw/sw.js`, inyectando la lista de
 * archivos a precachear y una versión derivada de sus nombres (con hash).
 * Sustituye a Workbox: ~60 líneas propias y cero dependencias (guía §5).
 */
function serviceWorker(): Plugin {
  return {
    name: 'ludus-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opciones, bundle) {
      const archivos = [
        ...Object.keys(bundle).filter((f) => !f.endsWith('.map')),
        ...archivosPublicos(join(raiz, 'public')),
      ].sort();
      const version = createHash('sha256')
        .update(paquete.version + '\n' + archivos.join('\n'))
        .digest('hex')
        .slice(0, 12);
      const plantilla = readFileSync(join(raiz, 'src', 'sw', 'sw.js'), 'utf8');
      const codigo = plantilla
        .replace('__LUDUS_VERSION__', `${paquete.version}-${version}`)
        .replace('[] /* __LUDUS_PRECACHE__ */', JSON.stringify(['./', ...archivos]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: codigo });
    },
  };
}

/** CSP estricta solo en producción: el servidor de desarrollo de Vite inyecta estilos en línea. */
function politicaDeSeguridad(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "worker-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'ludus-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  // Rutas relativas: la misma build sirve en GitHub Pages (/presonalApp/), en un subdirectorio o en la raíz.
  base: './',
  define: {
    __LUDUS_VERSION__: JSON.stringify(paquete.version),
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  plugins: [serviceWorker(), politicaDeSeguridad()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Presupuesto de la guía §14: < 150 KB de JS inicial comprimido.
    chunkSizeWarningLimit: 150,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/pruebas/configuracion.ts'],
  },
});
