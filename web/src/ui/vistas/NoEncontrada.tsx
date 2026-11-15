import { hrefDe } from '../enrutador';
import { useServicios } from '../servicios';

export function NoEncontrada() {
  const { t } = useServicios();
  return (
    <p>
      <a class="boton" href={hrefDe('/')}>
        {t('app.irAlInicio')}
      </a>
    </p>
  );
}
