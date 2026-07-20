# Payli API

Backend NestJS que publica las tasas oficiales de referencia utilizadas por
Payli. Las tasas de la Superintendencia Financiera de Colombia y del Banco
Central de Venezuela no sustituyen las tasas finales empleadas por cada
negocio.

## Desarrollo

```powershell
npm ci
npm run start:dev
```

`start:dev` conserva `NODE_USE_SYSTEM_CA=1` para usar el almacén de certificados
de Windows al consultar el BCV.

Endpoints:

- `GET /health`: disponibilidad del proceso, sin consultar fuentes externas.
- `GET /tasas/actuales`: tasas oficiales, vigencias y estado de caché.

## Configuración

- `PORT`: puerto asignado por el entorno; usa `3000` localmente.
- `NODE_ENV`: use `production` en despliegues.
- `CORS_ORIGINS`: lista opcional de orígenes web separados por comas. En
  producción, CORS queda deshabilitado si la variable está vacía. La app Android
  nativa no requiere CORS.

## Verificación

```powershell
npm run format:check
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Los comandos `format` y `lint:fix` aplican correcciones; las variantes usadas en
CI no modifican archivos.

## Railway

El archivo `railway.json` configura Railpack, el build reproducible, el comando
de producción, reinicios ante fallos y el health check en `/health`. Railway
asigna `PORT`; el servicio ya escucha en `0.0.0.0` y puede publicarse mediante un
dominio HTTPS administrado.

Después del primer despliegue:

1. Configure estas variables del servicio:
   - `NODE_ENV=production`
   - `NODE_USE_SYSTEM_CA=1`
   - `NODE_EXTRA_CA_CERTS=/app/certs/sectigo-public-server-auth-ca-dv-r36.pem`

   El certificado adicional completa la cadena TLS que el sitio del BCV no
   entrega, sin deshabilitar la validación de certificados.
2. Genere un dominio público y verifique
   `https://<servicio>.up.railway.app/health`.
3. Consulte dos veces `/tasas/actuales`; la segunda respuesta debe indicar
   `desdeCache: true`.
4. Compile Flutter con:

```powershell
flutter build apk --release --dart-define=API_BASE_URL=https://<servicio>.up.railway.app
```
