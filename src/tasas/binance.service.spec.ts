import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { BinanceService } from './binance.service';

function respuestaBinance(precio: string, status = 200): Response {
  return new Response(JSON.stringify({ data: [{ adv: { price: precio } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('BinanceService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  it('obtiene el primer anuncio orgánico de compra para COP y VES', async () => {
    const fetchSimulado = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuestaBinance('3187.00'))
      .mockResolvedValueOnce(respuestaBinance('846.000'));
    const servicio = new BinanceService();

    const respuesta = await servicio.obtenerTasas();

    expect(respuesta.tasas.usdtCop.valor).toBe(3187);
    expect(respuesta.tasas.usdtVes.valor).toBe(846);
    expect(respuesta.desdeCache).toBe(false);
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchSimulado.mock.calls[0][1]?.body as string)).toEqual(
      expect.objectContaining({
        asset: 'USDT',
        tradeType: 'BUY',
        fiat: 'COP',
        page: 1,
      }),
    );
  });

  it('reutiliza la respuesta durante un minuto', async () => {
    const fetchSimulado = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuestaBinance('3187'))
      .mockResolvedValueOnce(respuestaBinance('846'));
    const servicio = new BinanceService();

    await servicio.obtenerTasas();
    const respuesta = await servicio.obtenerTasas();

    expect(respuesta.desdeCache).toBe(true);
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('devuelve la última respuesta como desactualizada si Binance falla', async () => {
    let ahora = 1_000;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuestaBinance('3187'))
      .mockResolvedValueOnce(respuestaBinance('846'));
    const servicio = new BinanceService();
    await servicio.obtenerTasas();

    ahora += 60_001;
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('sin conexión'));
    const respuesta = await servicio.obtenerTasas();

    expect(respuesta.desactualizada).toBe(true);
    expect(respuesta.desdeCache).toBe(true);
  });

  it('rechaza una respuesta sin anuncios válidos', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuestaBinance('sin precio'))
      .mockResolvedValueOnce(respuestaBinance('846'));

    await expect(new BinanceService().obtenerTasas()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
