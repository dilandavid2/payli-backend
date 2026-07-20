import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { load } from 'cheerio';

interface RegistroTrm {
  valor: string;
  vigenciadesde: string;
  vigenciahasta: string;
}

interface TrmObtenida {
  valor: number;
  fechaVigencia: string;
}

interface TasasBcvObtenidas {
  usdVes: number;
  eurVes: number;
  fechaVigencia: string;
}

export interface TasaRespuesta {
  monedaBase: string;
  monedaDestino: string;
  valor: number;
  fuente: string;
  fechaVigencia: string;
}

export interface RespuestaTasas {
  modo: 'oficial';
  obtenidoEn: string;
  desdeCache: boolean;
  desactualizada: boolean;
  tasas: {
    usdCop: TasaRespuesta;
    usdVes: TasaRespuesta;
    eurVes: TasaRespuesta;
  };
}

@Injectable()
export class TasasService {
  private readonly logger = new Logger(TasasService.name);

  private readonly urlTrm = 'https://www.datos.gov.co/resource/mcec-87by.json';

  private readonly urlBcv = 'https://www.bcv.org.ve/';

  private respuestaEnCache: RespuestaTasas | null = null;
  private vencimientoCache = 0;
  private readonly duracionCacheMs = 60 * 60 * 1000;
  private readonly timeoutFuentesMs = 8_000;

  async obtenerTasasActuales(): Promise<RespuestaTasas> {
    if (this.respuestaEnCache !== null && Date.now() < this.vencimientoCache) {
      return {
        ...this.respuestaEnCache,
        desdeCache: true,
      };
    }

    try {
      const respuesta = await this.consultarFuentesOficiales();

      this.respuestaEnCache = respuesta;
      this.vencimientoCache = Date.now() + this.duracionCacheMs;

      return respuesta;
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No fue posible actualizar las tasas: ${detalle}`);

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

  private async consultarFuentesOficiales(): Promise<RespuestaTasas> {
    const fechaActual = new Date().toISOString();

    const [trm, tasasBcv] = await Promise.all([
      this.obtenerTrmOficial(),
      this.obtenerTasasBcvOficiales(),
    ]);

    return {
      modo: 'oficial',
      obtenidoEn: fechaActual,
      desdeCache: false,
      desactualizada: false,
      tasas: {
        usdCop: {
          monedaBase: 'USD',
          monedaDestino: 'COP',
          valor: trm.valor,
          fuente: 'Superintendencia Financiera de Colombia',
          fechaVigencia: trm.fechaVigencia,
        },
        usdVes: {
          monedaBase: 'USD',
          monedaDestino: 'VES',
          valor: tasasBcv.usdVes,
          fuente: 'Banco Central de Venezuela',
          fechaVigencia: tasasBcv.fechaVigencia,
        },
        eurVes: {
          monedaBase: 'EUR',
          monedaDestino: 'VES',
          valor: tasasBcv.eurVes,
          fuente: 'Banco Central de Venezuela',
          fechaVigencia: tasasBcv.fechaVigencia,
        },
      },
    };
  }

  private async obtenerTrmOficial(): Promise<TrmObtenida> {
    const url = new URL(this.urlTrm);

    url.searchParams.set('$limit', '1');
    url.searchParams.set('$order', 'vigenciadesde DESC');

    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutFuentesMs),
    });

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        `No fue posible consultar la TRM: ${respuesta.status}`,
      );
    }

    const registros = (await respuesta.json()) as RegistroTrm[];

    if (registros.length === 0) {
      throw new ServiceUnavailableException(
        'La fuente oficial no devolvió la TRM.',
      );
    }

    const valor = Number(registros[0].valor);

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new ServiceUnavailableException(
        'La fuente oficial devolvió una TRM inválida.',
      );
    }

    return {
      valor,
      fechaVigencia: registros[0].vigenciadesde.substring(0, 10),
    };
  }

  private async obtenerTasasBcvOficiales(): Promise<TasasBcvObtenidas> {
    const respuesta = await fetch(this.urlBcv, {
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: 'text/html',
      },
      signal: AbortSignal.timeout(this.timeoutFuentesMs),
    });

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        `No fue posible consultar el BCV: ${respuesta.status}`,
      );
    }

    const html = await respuesta.text();
    const pagina = load(html);

    const textoUsd = pagina('#dolar strong').last().text().trim();
    const textoEur = pagina('#euro strong').last().text().trim();
    const textoFecha = pagina('span.date-display-single').first().text().trim();

    const usdVes = this.convertirNumeroBcv(textoUsd);
    const eurVes = this.convertirNumeroBcv(textoEur);
    const fechaVigencia = this.convertirFechaBcv(textoFecha);

    return {
      usdVes,
      eurVes,
      fechaVigencia,
    };
  }

  private convertirNumeroBcv(texto: string): number {
    const textoNormalizado = texto
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');

    const valor = Number(textoNormalizado);

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new ServiceUnavailableException(
        `El BCV devolvió un valor inválido: ${texto}`,
      );
    }

    return valor;
  }

  private convertirFechaBcv(texto: string): string {
    const textoNormalizado = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const coincidencia = textoNormalizado.match(
      /(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/i,
    );

    if (coincidencia === null) {
      throw new ServiceUnavailableException(
        `El BCV devolvió una fecha inválida: ${texto}`,
      );
    }

    const meses: Record<string, string> = {
      enero: '01',
      febrero: '02',
      marzo: '03',
      abril: '04',
      mayo: '05',
      junio: '06',
      julio: '07',
      agosto: '08',
      septiembre: '09',
      octubre: '10',
      noviembre: '11',
      diciembre: '12',
    };

    const mes = meses[coincidencia[2].toLowerCase()];

    if (mes === undefined) {
      throw new ServiceUnavailableException(
        `El BCV devolvió un mes desconocido: ${texto}`,
      );
    }

    const dia = coincidencia[1].padStart(2, '0');
    const anio = coincidencia[3];

    return `${anio}-${mes}-${dia}`;
  }
}
