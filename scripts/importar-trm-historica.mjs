const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, '');
const token = process.env.IMPORT_HISTORY_TOKEN;

if (!apiBaseUrl || !token) {
  throw new Error('Configure API_BASE_URL e IMPORT_HISTORY_TOKEN.');
}

const url = new URL('https://www.datos.gov.co/resource/32sa-8pi3.json');
url.searchParams.set('$select', 'valor,vigenciadesde');
url.searchParams.set('$order', 'vigenciadesde ASC');
url.searchParams.set('$limit', '50000');

const respuesta = await fetch(url, {
  headers: {
    accept: 'application/json',
    'user-agent': 'Mozilla/5.0 (compatible; Payli history importer/1.0)',
  },
});

if (!respuesta.ok) {
  throw new Error(`Datos Abiertos respondió ${respuesta.status}.`);
}

const registros = await respuesta.json();
const puntos = registros
  .map((registro) => ({
    valor: Number(registro.valor),
    fecha: String(registro.vigenciadesde ?? '').substring(0, 10),
  }))
  .filter(
    (registro) =>
      Number.isFinite(registro.valor) &&
      registro.valor > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(registro.fecha),
  );

console.log(`Fuente oficial descargada: ${puntos.length} registros.`);

const tamanoLote = 500;
let importados = 0;

for (let inicio = 0; inicio < puntos.length; inicio += tamanoLote) {
  const lote = puntos.slice(inicio, inicio + tamanoLote);
  const carga = await fetch(`${apiBaseUrl}/tasas/historial/importar-trm`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(lote),
  });

  if (!carga.ok) {
    throw new Error(
      `El backend rechazó el lote ${inicio / tamanoLote + 1}: ${carga.status}.`,
    );
  }

  importados += lote.length;
  console.log(`Importados ${importados} de ${puntos.length}.`);
}

console.log(`TRM histórica importada: ${importados} registros.`);
