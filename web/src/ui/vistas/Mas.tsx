import { Icono } from '../componentes';
import type { ElementoDeNavegacion } from '../App';
import { hrefDe } from '../enrutador';
import { useServicios } from '../servicios';

/** Elementos de navegación que no caben en la barra inferior del móvil. */
export function Mas({ elementos }: { elementos: readonly ElementoDeNavegacion[] }) {
  const { t } = useServicios();
  return (
    <ul class="lista-enlaces">
      {elementos.map((e) => (
        <li key={e.ruta}>
          <a class="lista-enlaces__enlace" href={hrefDe(e.ruta)}>
            <Icono d={e.icono} />
            {t(e.etiqueta)}
          </a>
        </li>
      ))}
    </ul>
  );
}
