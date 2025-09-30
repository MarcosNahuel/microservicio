# Microservicio de Upload a Kommo Drive

Servicio HTTP en Node.js que recibe imagenes desde n8n y las sube directamente a Kommo Drive sin almacenar nada en disco. Ofrece dos rutas: con archivo binario (`/upload`) o con URL (`/process-url`).

## Requisitos
- Node.js 20+
- Cuenta Kommo con acceso a la Drive API y un token OAuth valido que llega desde n8n

## Instalacion rapida
1. Instala dependencias: `npm install`
2. (Opcional) Configura variables de entorno
3. Ejecuta el servicio: `npm start`
4. Comprueba salud: `curl http://localhost:3000/health`

## Variables de entorno relevantes
- `PORT` (default `3000`)
- `JSON_BODY_LIMIT` limite para `POST /process-url` (default `1mb`)
- `MAX_UPLOAD_BYTES` tamano maximo aceptado en memoria (default `25MB`)
- `MAX_REMOTE_BYTES` tope para descargas remotas (default igual a `MAX_UPLOAD_BYTES`)
- `REMOTE_FETCH_TIMEOUT_MS` timeout al descargar imagenes (default `20000`)
- `KOMMO_TIMEOUT_MS` timeout al hablar con Kommo (default `20000`)
- `KOMMO_MAX_RETRIES` reintentos al subir cada chunk (default `1`)

## Endpoints

### POST `/process-url`
Recomendado: n8n envia solo la URL de la imagen, el `drive_url` y el `access_token`. El microservicio descarga, calcula metadata y sube a Kommo.

**JSON de entrada**
```json
{
  "image_url": "https://cdn.shopify.com/.../imagen.jpg",
  "drive_url": "https://drive-c.kommo.com",
  "access_token": "TOKEN_OAUTH2",
  "file_name": "opcional.jpg"
}
```

**Respuesta**
```json
{
  "success": true,
  "file": { "name": "imagen.jpg", "size": 123456, "mime_type": "image/jpeg" },
  "kommo": {
    "session_uuid": "...",
    "file_uuid": "...",
    "session": { "max_part_size": 131072, ... },
    "upload": { "uuid": "...", "link": { ... } }
  }
}
```

### POST `/upload`
Alternativa cuando n8n ya tiene el binario. Se envia un formulario `multipart/form-data` con el archivo y los campos extra.

**Campos**
- `image` (binario, requerido)
- `drive_url` (texto, requerido)
- `access_token` (texto, requerido)
- `file_name` (texto, opcional)

Ejemplo cURL:
```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@test.jpg" \
  -F "drive_url=https://drive-c.kommo.com" \
  -F "access_token=TOKEN"
```

## Flujo tipico en n8n
1. Extrae URL de imagen del mensaje
2. Consulta `drive_url` de la cuenta (endpoint `/account?with=drive_url`)
3. Construye JSON y llama a `POST /process-url`
4. Recibe de vuelta metadatos + UUID final de Kommo Drive

## Despliegue rapido (Docker)
```bash
docker build -t kommo-upload-service .
docker run -d --name kommo-upload -p 3000:3000 kommo-upload-service
```

## Despliegue con PM2 (sin Docker)
```bash
pm2 start server.js --name kommo-upload
pm2 logs kommo-upload
```

## Notas
- El servicio valida tamano y MIME basico; todos los errores se devuelven en JSON.
- La URL de Kommo se normaliza (`*.amocrm.com` cambia a `*.kommo.com`).
- No se escribe nada en `/var/www/public/images`; ya no se expone contenido estatico.
- Si Kommo devuelve `max_part_size`, el microservicio corta el buffer en chunks y los sube respetando ese limite.

