import { BadRequestException } from '@nestjs/common';
import { EncuestasRepository } from './encuestas.repository';
import { EncuestasService } from './encuestas.service';

describe('EncuestasService', () => {
  it('guarda una respuesta anónima válida', async () => {
    const repositorio = new EncuestasRepository();
    const servicio = new EncuestasService(repositorio);

    await expect(
      servicio.guardar({
        categoria: 'alimentos',
        producto: 'Café',
        comercio: 'Mercado central',
        ciudad: 'Caracas',
        etapa: 'planeo_comprar',
        modoComparacion: 'un_monto',
        montos: { USD: 10 },
      }),
    ).resolves.toEqual({ guardada: true });
    expect(repositorio.memoria).toHaveLength(1);
    expect(repositorio.memoria[0].producto).toBe('Café');
  });

  it('rechaza categorías y montos inválidos', async () => {
    const servicio = new EncuestasService(new EncuestasRepository());

    await expect(
      servicio.guardar({
        categoria: 'desconocida',
        etapa: 'explorando',
        modoComparacion: 'un_monto',
        montos: { USD: -1 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
