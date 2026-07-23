import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Configure DATABASE_PUBLIC_URL o DATABASE_URL.');
}

const url = new URL(
  'https://www.datos.gov.co/resource/32sa-8pi3.json',
);
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
const pool = new pg.Pool({ connectionString: databaseUrl });
const cliente = await pool.connect();

try {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS historial_tasas (
      par VARCHAR(7) NOT NULL,
      fecha DATE NOT NULL,
      valor DOUBLE PRECISION NOT NULL CHECK (valor > 0),
      fuente TEXT NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (par, fecha)
    )
  `);
  await cliente.query('BEGIN');

  let importados = 0;

  for (const registro of registros) {
    const valor = Number(registro.valor);
    const fecha = String(registro.vigenciadesde ?? '').substring(0, 10);

    if (
      !Number.isFinite(valor) ||
      valor <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
      continue;
    }

    await cliente.query(
      `
        INSERT INTO historial_tasas (par, fecha, valor, fuente)
        VALUES ('USD_COP', $1, $2, 'Superintendencia Financiera de Colombia')
        ON CONFLICT (par, fecha)
        DO UPDATE SET valor = EXCLUDED.valor, fuente = EXCLUDED.fuente
      `,
      [fecha, valor],
    );
    importados++;
  }

  await cliente.query('COMMIT');
  console.log(`TRM histórica importada: ${importados} registros.`);
} catch (error) {
  await cliente.query('ROLLBACK');
  throw error;
} finally {
  cliente.release();
  await pool.end();
}
