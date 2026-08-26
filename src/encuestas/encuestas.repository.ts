import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';

export interface EncuestaComparacion {
  categoria: string;
  producto?: string;
  comercio?: string;
  ciudad?: string;
  etapa: string;
  modoComparacion: string;
  montos: Record<string, number>;
}

@Injectable()
export class EncuestasRepository implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EncuestasRepository.name);
  private readonly pool: Pool | null;
  readonly memoria: EncuestaComparacion[] = [];

  constructor() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    this.pool = databaseUrl
      ? new Pool({ connectionString: databaseUrl })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (this.pool === null) {
      this.logger.warn(
        'DATABASE_URL no está configurada; las encuestas serán temporales.',
      );
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS encuestas_comparacion (
        id BIGSERIAL PRIMARY KEY,
        categoria VARCHAR(40) NOT NULL,
        producto VARCHAR(100),
        comercio VARCHAR(100),
        ciudad VARCHAR(80),
        etapa VARCHAR(30) NOT NULL,
        modo_comparacion VARCHAR(20) NOT NULL,
        montos JSONB NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async guardar(encuesta: EncuestaComparacion): Promise<void> {
    this.memoria.push(encuesta);
    if (this.pool === null) return;

    await this.pool.query(
      `
        INSERT INTO encuestas_comparacion
          (categoria, producto, comercio, ciudad, etapa, modo_comparacion, montos)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        encuesta.categoria,
        encuesta.producto ?? null,
        encuesta.comercio ?? null,
        encuesta.ciudad ?? null,
        encuesta.etapa,
        encuesta.modoComparacion,
        JSON.stringify(encuesta.montos),
      ],
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
