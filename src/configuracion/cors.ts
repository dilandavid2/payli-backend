import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function crearOpcionesCors(
  entorno: string | undefined,
  origenesConfigurados: string | undefined,
): CorsOptions | null {
  if (entorno !== 'production') {
    return { origin: true };
  }

  const origenes = origenesConfigurados
    ?.split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);

  if (origenes === undefined || origenes.length === 0) {
    return null;
  }

  return { origin: origenes };
}
