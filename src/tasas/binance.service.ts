import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

interface AnuncioBinance {
  adv?: {
    price?: string;
  };
}

interface RespuestaBinanceApi {
  data?: AnuncioBinance[];
}

export interface TasaBinanceRespuesta {
  monedaBase: 'USDT';
  monedaDestino: 'COP' | 'VES';
  valor: number;
  fuente: 'Binance P2P';
  actualizadoEn: string;
}

export interface RespuestaTasasBinance {
  modo: 'binance';
  obtenidoEn: string;
  desdeCache: boolean;
  desactualizada: boolean;
  tasas: {
    usdtCop: TasaBinanceRespuesta;
    usdtVes: TasaBinanceRespuesta;
  };
}

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly url =
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  private readonly duracionCacheMs = 60 * 1000;
  private readonly timeoutMs = 8_000;
  private respuestaEnCache: RespuestaTasasBinance | null = null;
  private vencimientoCache = 0;

  async obtenerTasas(): Promise<RespuestaTasasBinance> {
    if (this.respuestaEnCache !== null && Date.now() < this.vencimientoCache) {
      return { ...this.respuestaEnCache, desdeCache: true };
    }

    try {
      const obtenidoEn = new Date().toISOString();
      const [usdtCop, usdtVes] = await Promise.all([
        this.obtenerPrecio('COP'),
        this.obtenerPrecio('VES'),
      ]);
      const respuesta: RespuestaTasasBinance = {
        modo: 'binance',
        obtenidoEn,
        desdeCache: false,
        desactualizada: false,
        tasas: {
          usdtCop: this.crearTasa('COP', usdtCop, obtenidoEn),
          usdtVes: this.crearTasa('VES', usdtVes, obtenidoEn),
        },
      };

      this.respuestaEnCache = respuesta;
      this.vencimientoCache = Date.now() + this.duracionCacheMs;
      return respuesta;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No fue posible actualizar Binance P2P: ${detalle}`);

      if (this.respuestaEnCache !== null) {
        return {
          ...this.respuestaEnCache,
          desdeCache: true,
          desactualizada: true,
        };
      }

      throw error;
    }
  }

  private crearTasa(
    monedaDestino: 'COP' | 'VES',
    valor: number,
    actualizadoEn: string,
  ): TasaBinanceRespuesta {
    return {
      monedaBase: 'USDT',
      monedaDestino,
      valor,
      fuente: 'Binance P2P',
      actualizadoEn,
    };
  }

  private async obtenerPrecio(fiat: 'COP' | 'VES'): Promise<number> {
    const respuesta = await fetch(this.url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; Payli/1.0)',
      },
      body: JSON.stringify({
        page: 1,
        rows: 10,
        payTypes: [],
        publisherType: null,
        asset: 'USDT',
        tradeType: 'BUY',
        fiat,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        `Binance P2P respondió con ${respuesta.status} para ${fiat}.`,
      );
    }

    const cuerpo = (await respuesta.json()) as RespuestaBinanceApi;
    const primerAnuncio = cuerpo.data?.[0];
    const valor = Number(primerAnuncio?.adv?.price);

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new ServiceUnavailableException(
        `Binance P2P no devolvió un anuncio de compra válido para ${fiat}.`,
      );
    }

    return valor;
  }
}
