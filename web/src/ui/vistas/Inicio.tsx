import type { ComponentType } from 'preact';
import { Vacio, VistaDiferida } from '../componentes';
import { useServicios } from '../servicios';

/** Inicio: un saludo y las tarjetas de resumen que aporta cada módulo. */
export function Inicio() {
  const s = useServicios();
  const tarjetas = s.registro.tarjetasDeInicio();
  return (
    <div class="pila">
      <p class="texto-destacado">{s.t('inicio.saludo')}</p>
      {tarjetas.length === 0 ? (
        <Vacio>{s.t('inicio.sinTarjetas')}</Vacio>
      ) : (
        <div class="rejilla">
          {tarjetas.map((t) => (
            <VistaDiferida
              key={`${t.moduloId}-${t.orden}`}
              cargar={t.vista as () => Promise<ComponentType<object>>}
              props={{ ctx: s.contextoDe(t.moduloId) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
