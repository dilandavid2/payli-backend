import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { HistorialTasasRepository } from './historial-tasas.repository';
import { TasasService } from './tasas.service';

const trmValida = [
  {
    valor: '3262.58',
    vigenciadesde: '2026-07-18T00:00:00.000',
    vigenciahasta: '2026-07-18T00:00:00.000',
  },
];

const paginaBcvValida = `
  <div id="dolar"><strong>736,93390000</strong></div>
  <div id="euro"><strong>850,25000000</strong></div>
  <span class="date-display-single">Viernes 18 de Julio de 2026</span>
`;

const respuestaSoapTrmValida = `
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <queryTCRMResponse>
        <return>
          <validityFrom>2026-07-18T00:00:00-05:00</validityFrom>
          <value>3262.58</value>
          <success>true</success>
        </return>
      </queryTCRMResponse>
    </soap:Body>
  </soap:Envelope>
`;

function respuestaJson(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function respuestaHtml(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

function respuestaXml(xml: string, status = 200): Response {
  return new Response(xml, {
    status,
    headers: { 'content-type': 'text/xml' },
  });
}

function prepararFuentes(
  trm: unknown = trmValida,
  bcv: string = paginaBcvValida,
) {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(respuestaJson(trm))
    .mockResolvedValueOnce(respuestaHtml(bcv));
}

describe('TasasService', () => {
  let advertir: jest.SpiedFunction<Logger['warn']>;

  function crearServicio() {
    return new TasasService(new HistorialTasasRepository());
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    delete process.env.IMPORT_HISTORY_TOKEN;
    advertir = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  it('convierte las tasas y fechas oficiales', async () => {
    const fetchSimulado = prepararFuentes();
    const servicio = crearServicio();

    const respuesta = await servicio.obtenerTasasActuales();

    expect(respuesta.desdeCache).toBe(false);
    expect(respuesta.desactualizada).toBe(false);
    expect(respuesta.tasas.usdCop.valor).toBe(3262.58);
    expect(respuesta.tasas.usdVes.valor).toBe(736.9339);
    expect(respuesta.tasas.eurVes.valor).toBe(850.25);
    expect(respuesta.tasas.usdVes.fechaVigencia).toBe('2026-07-18');
    const [urlTrm, opcionesTrm] = fetchSimulado.mock.calls[0];
    expect(urlTrm).toBeInstanceOf(URL);
    expect((urlTrm as URL).hostname).toBe('www.datos.gov.co');
    expect((urlTrm as URL).pathname).toBe('/resource/32sa-8pi3.json');
    expect(opcionesTrm?.headers).toEqual({
      accept: 'application/json',
      'user-agent': expect.stringContaining('Payli') as string,
    });
  });

  it('reutiliza la respuesta durante la vigencia de la caché', async () => {
    const fetchSimulado = prepararFuentes();
    const servicio = crearServicio();

    await servicio.obtenerTasasActuales();
    const respuesta = await servicio.obtenerTasasActuales();

    expect(respuesta.desdeCache).toBe(true);
    expect(respuesta.desactualizada).toBe(false);
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('usa el web service oficial si Datos Abiertos rechaza la consulta', async () => {
    const fetchSimulado = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuestaJson({}, 403))
      .mockResolvedValueOnce(respuestaHtml(paginaBcvValida))
      .mockResolvedValueOnce(respuestaXml(respuestaSoapTrmValida));
    const servicio = crearServicio();

    const respuesta = await servicio.obtenerTasasActuales();

    expect(respuesta.tasas.usdCop.valor).toBe(3262.58);
    expect(respuesta.tasas.usdCop.fechaVigencia).toBe('2026-07-18');
    expect(fetchSimulado).toHaveBeenCalledTimes(3);
    expect(fetchSimulado.mock.calls[2][0]).toBe(
      'https://www.superfinanciera.gov.co/SuperfinancieraWebServiceTRM/TCRMServicesWebService/TCRMServicesWebService',
    );
    expect(fetchSimulado.mock.calls[2][1]?.method).toBe('POST');
    expect(advertir).toHaveBeenCalledWith(
      expect.stringContaining('se usará el web service TRM'),
    );
  });

  it('devuelve la caché como desactualizada si falla la renovación', async () => {
    let ahora = 1_000;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    prepararFuentes();
    const servicio = crearServicio();
    await servicio.obtenerTasasActuales();

    ahora += 60 * 60 * 1000 + 1;
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fuente caída'));
    const respuesta = await servicio.obtenerTasasActuales();

    expect(respuesta.desdeCache).toBe(true);
    expect(respuesta.desactualizada).toBe(true);
    expect(advertir).toHaveBeenCalledWith(
      expect.stringContaining('fuente caída'),
    );
  });

  it('rechaza una TRM inválida sin caché', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respuestaJson([{ ...trmValida[0], valor: '-1' }]))
      .mockResolvedValueOnce(respuestaHtml(paginaBcvValida))
      .mockResolvedValueOnce(
        respuestaXml(respuestaSoapTrmValida.replace('3262.58', '-1')),
      );
    const servicio = crearServicio();

    await expect(servicio.obtenerTasasActuales()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rechaza un número BCV inválido sin caché', async () => {
    prepararFuentes(
      trmValida,
      paginaBcvValida.replace('736,93390000', 'sin valor'),
    );
    const servicio = crearServicio();

    await expect(servicio.obtenerTasasActuales()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rechaza una fecha BCV inválida sin caché', async () => {
    prepararFuentes(
      trmValida,
      paginaBcvValida.replace('Viernes 18 de Julio de 2026', 'fecha inválida'),
    );
    const servicio = crearServicio();

    await expect(servicio.obtenerTasasActuales()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('importa historia TRM sólo con el token configurado', async () => {
    process.env.IMPORT_HISTORY_TOKEN = 'token-de-prueba';
    const repositorio = new HistorialTasasRepository();
    const servicio = new TasasService(repositorio);

    await expect(
      servicio.importarHistorialTrm('Bearer incorrecto', []),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      servicio.importarHistorialTrm('Bearer token-de-prueba', [
        { fecha: '2026-07-18', valor: 3262.58 },
      ]),
    ).resolves.toEqual({ importados: 1 });
    await expect(repositorio.obtener('USD_COP', 'MAX')).resolves.toEqual([
      { fecha: '2026-07-18', valor: 3262.58 },
    ]);
  });
});
