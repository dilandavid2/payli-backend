import { HistorialTasasRepository } from './historial-tasas.repository';
import { TasaRespuesta } from './tasas.service';

function tasa(
  monedaBase: string,
  monedaDestino: string,
  valor: number,
  fechaVigencia: string,
): TasaRespuesta {
  return {
    monedaBase,
    monedaDestino,
    valor,
    fechaVigencia,
    fuente: 'Fuente oficial',
  };
}

describe('HistorialTasasRepository', () => {
  const databaseUrlOriginal = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (databaseUrlOriginal === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = databaseUrlOriginal;
    }
  });

  it('guarda las tres tasas y las devuelve ordenadas', async () => {
    const repositorio = new HistorialTasasRepository();

    await repositorio.guardarTasas({
      usdCop: tasa('USD', 'COP', 3262.58, '2026-07-18'),
      usdVes: tasa('USD', 'VES', 736.9339, '2026-07-20'),
      eurVes: tasa('EUR', 'VES', 843.19, '2026-07-20'),
    });
    await repositorio.guardarTasas({
      usdCop: tasa('USD', 'COP', 3270, '2026-07-19'),
      usdVes: tasa('USD', 'VES', 740, '2026-07-21'),
      eurVes: tasa('EUR', 'VES', 850, '2026-07-21'),
    });

    await expect(repositorio.obtener('USD_COP', 'MAX')).resolves.toEqual([
      { fecha: '2026-07-18', valor: 3262.58 },
      { fecha: '2026-07-19', valor: 3270 },
    ]);
  });

  it('filtra los puntos según el periodo solicitado', async () => {
    const repositorio = new HistorialTasasRepository();

    await repositorio.guardarTasas({
      usdCop: tasa('USD', 'COP', 3200, '2026-06-01'),
      usdVes: tasa('USD', 'VES', 700, '2026-06-01'),
      eurVes: tasa('EUR', 'VES', 800, '2026-06-01'),
    });
    await repositorio.guardarTasas({
      usdCop: tasa('USD', 'COP', 3262.58, '2026-07-18'),
      usdVes: tasa('USD', 'VES', 736.9339, '2026-07-18'),
      eurVes: tasa('EUR', 'VES', 843.19, '2026-07-18'),
    });

    await expect(
      repositorio.obtener('USD_COP', '7D', new Date('2026-07-23T12:00:00Z')),
    ).resolves.toEqual([{ fecha: '2026-07-18', valor: 3262.58 }]);
  });
});
