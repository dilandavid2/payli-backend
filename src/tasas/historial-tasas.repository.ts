import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { TasaRespuesta } from './tasas.service';

export const paresTasa = ['USD_COP', 'USD_VES', 'EUR_VES'] as const;
export type ParTasa = (typeof paresTasa)[number];

export const periodosHistorial = ['7D', '1M', '3M', '1A', 'MAX'] as const;
export type PeriodoHistorial = (typeof periodosHistorial)[number];

export interface PuntoHistorial {
  fecha: string;
  valor: number;
}

interface TasaParaGuardar {
  par: ParTasa;
  tasa: TasaRespuesta;
}

@Injectable()
export class HistorialTasasRepository implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HistorialTasasRepository.name);
  private readonly memoria = new Map<string, PuntoHistorial>();
  private readonly pool: Pool | null;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    this.pool = databaseUrl
      ? new Pool({ connectionString: databaseUrl })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (this.pool === null) {
      this.logger.warn(
        'DATABASE_URL no está configurada; el historial BCV será temporal.',
      );
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS historial_tasas (
        par VARCHAR(7) NOT NULL,
        fecha DATE NOT NULL,
        valor DOUBLE PRECISION NOT NULL CHECK (valor > 0),
        fuente TEXT NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (par, fecha)
      )
    `);
  }

  async guardarTasas(tasas: {
    usdCop: TasaRespuesta;
    usdVes: TasaRespuesta;
    eurVes: TasaRespuesta;
  }): Promise<void> {
    const registros: TasaParaGuardar[] = [
      { par: 'USD_COP', tasa: tasas.usdCop },
      { par: 'USD_VES', tasa: tasas.usdVes },
      { par: 'EUR_VES', tasa: tasas.eurVes },
    ];

    for (const registro of registros) {
      this.memoria.set(`${registro.par}:${registro.tasa.fechaVigencia}`, {
        fecha: registro.tasa.fechaVigencia,
        valor: registro.tasa.valor,
      });
    }

    if (this.pool === null) {
      return;
    }

    const cliente = await this.pool.connect();

    try {
      await cliente.query('BEGIN');

      for (const registro of registros) {
        await cliente.query(
          `
            INSERT INTO historial_tasas (par, fecha, valor, fuente)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (par, fecha)
            DO UPDATE SET valor = EXCLUDED.valor, fuente = EXCLUDED.fuente
          `,
          [
            registro.par,
            registro.tasa.fechaVigencia,
            registro.tasa.valor,
            registro.tasa.fuente,
          ],
        );
      }

      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async guardarPuntosTrm(puntos: PuntoHistorial[]): Promise<void> {
    for (const punto of puntos) {
      this.memoria.set(`USD_COP:${punto.fecha}`, punto);
    }

    if (this.pool === null || puntos.length === 0) {
      return;
    }

    const parametros: unknown[] = [];
    const valores = puntos.map((punto, indice) => {
      const posicion = indice * 2;
      parametros.push(punto.fecha, punto.valor);
      return `('USD_COP', $${posicion + 1}, $${posicion + 2}, 'Superintendencia Financiera de Colombia')`;
    });

    await this.pool.query(
      `
        INSERT INTO historial_tasas (par, fecha, valor, fuente)
        VALUES ${valores.join(', ')}
        ON CONFLICT (par, fecha)
        DO UPDATE SET valor = EXCLUDED.valor, fuente = EXCLUDED.fuente
      `,
      parametros,
    );
  }

  async obtener(
    par: ParTasa,
    periodo: PeriodoHistorial,
    ahora = new Date(),
  ): Promise<PuntoHistorial[]> {
    const desde = this.calcularDesde(periodo, ahora);

    if (this.pool !== null) {
      const parametros: unknown[] = [par];
      let filtroFecha = '';

      if (desde !== null) {
        parametros.push(desde);
        filtroFecha = 'AND fecha >= $2';
      }

      const resultado = await this.pool.query<{
        fecha: string | Date;
        valor: number;
      }>(
        `
          SELECT fecha, valor
          FROM historial_tasas
          WHERE par = $1 ${filtroFecha}
          ORDER BY fecha ASC
        `,
        parametros,
      );

      return resultado.rows.map((fila) => ({
        fecha:
          fila.fecha instanceof Date
            ? fila.fecha.toISOString().substring(0, 10)
            : String(fila.fecha).substring(0, 10),
        valor: Number(fila.valor),
      }));
    }

    return [...this.memoria.entries()]
      .filter(([clave, punto]) => {
        if (!clave.startsWith(`${par}:`)) {
          return false;
        }

        return desde === null || punto.fecha >= desde;
      })
      .map(([, punto]) => punto)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private calcularDesde(periodo: PeriodoHistorial, ahora: Date): string | null {
    if (periodo === 'MAX') {
      return null;
    }

    const fecha = new Date(ahora);
    const dias: Record<Exclude<PeriodoHistorial, 'MAX'>, number> = {
      '7D': 7,
      '1M': 31,
      '3M': 93,
      '1A': 366,
    };

    fecha.setUTCDate(fecha.getUTCDate() - dias[periodo]);
    return fecha.toISOString().substring(0, 10);
  }
}
