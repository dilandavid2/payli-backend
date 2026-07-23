import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { TasasService } from './../src/tasas/tasas.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TasasService)
      .useValue({
        obtenerTasasActuales: jest.fn().mockResolvedValue({
          modo: 'oficial',
          obtenidoEn: '2026-07-19T12:00:00.000Z',
          desdeCache: false,
          desactualizada: false,
          tasas: {},
        }),
        obtenerHistorial: jest.fn().mockResolvedValue({
          par: 'USD_COP',
          periodo: '1M',
          puntos: [{ fecha: '2026-07-18', valor: 3262.58 }],
        }),
        importarHistorialTrm: jest.fn().mockResolvedValue({ importados: 1 }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    const body = respuesta.body as { status: string; timestamp: string };

    expect(body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('/tasas/actuales (GET)', () => {
    return request(app.getHttpServer())
      .get('/tasas/actuales')
      .expect(200)
      .expect({
        modo: 'oficial',
        obtenidoEn: '2026-07-19T12:00:00.000Z',
        desdeCache: false,
        desactualizada: false,
        tasas: {},
      });
  });

  it('/tasas/historial (GET)', () => {
    return request(app.getHttpServer())
      .get('/tasas/historial?par=USD_COP&periodo=1M')
      .expect(200)
      .expect({
        par: 'USD_COP',
        periodo: '1M',
        puntos: [{ fecha: '2026-07-18', valor: 3262.58 }],
      });
  });

  it('/tasas/historial/importar-trm (POST)', () => {
    return request(app.getHttpServer())
      .post('/tasas/historial/importar-trm')
      .set('Authorization', 'Bearer temporal')
      .send([{ fecha: '2026-07-18', valor: 3262.58 }])
      .expect(201)
      .expect({ importados: 1 });
  });

  afterEach(async () => {
    await app.close();
  });
});
