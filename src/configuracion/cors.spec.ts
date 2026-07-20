import { crearOpcionesCors } from './cors';

describe('crearOpcionesCors', () => {
  it('permite solicitudes CORS en desarrollo', () => {
    expect(crearOpcionesCors('development', undefined)).toEqual({
      origin: true,
    });
  });

  it('deshabilita CORS en producción sin orígenes configurados', () => {
    expect(crearOpcionesCors('production', undefined)).toBeNull();
    expect(crearOpcionesCors('production', ' , ')).toBeNull();
  });

  it('limita producción a los orígenes configurados', () => {
    expect(
      crearOpcionesCors(
        'production',
        'https://payli.example, https://admin.payli.example',
      ),
    ).toEqual({
      origin: ['https://payli.example', 'https://admin.payli.example'],
    });
  });
});
