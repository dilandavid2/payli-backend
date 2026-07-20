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

## Render

El archivo `render.yaml` define un servicio Starter en Virginia, enlazado a
GitHub, con despliegue después de aprobar CI y health check en `/health`.
Render asigna `PORT`, termina TLS y publica el servicio mediante HTTPS.

Después del primer despliegue:

1. Verifique `https://<servicio>.onrender.com/health`.
2. Consulte dos veces `/tasas/actuales`; la segunda respuesta debe indicar
   `desdeCache: true`.
3. Compile Flutter con:

```powershell
flutter build apk --release --dart-define=API_BASE_URL=https://<servicio>.onrender.com
```
