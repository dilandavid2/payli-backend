import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EncuestasModule } from '../src/encuestas/encuestas.module';
import { EncuestasRepository } from '../src/encuestas/encuestas.repository';

describe('Encuestas (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      imports: [EncuestasModule],
    })
      .overrideProvider(EncuestasRepository)
      .useValue({ guardar: jest.fn().mockResolvedValue(undefined) })
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  it('POST /encuestas/comparacion', () => {
    return request(app.getHttpServer())
      .post('/encuestas/comparacion')
      .send({
        categoria: 'farmacia',
        etapa: 'ya_compre',
        modoComparacion: 'tres_precios',
        montos: { USD: 10, COP: 32000, VES: 8000 },
      })
      .expect(200)
      .expect({ guardada: true });
  });

  afterEach(async () => app.close());
});
