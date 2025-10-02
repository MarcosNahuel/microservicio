# Uso del Microservicio desde n8n

## Configuración del nodo HTTP Request

### Parámetros requeridos:

```json
{
  "image_url": "URL_DE_LA_IMAGEN",
  "drive_url": "https://drive-c.kommo.com",
  "access_token": "{{ $credentials.oAuth2Api.oauthTokenData.access_token }}"
}
```

### Parámetros opcionales para adjuntar a entidad:

```json
{
  "image_url": "URL_DE_LA_IMAGEN",
  "drive_url": "https://drive-c.kommo.com",
  "access_token": "{{ $credentials.oAuth2Api.oauthTokenData.access_token }}",
  "entity": "leads",
  "entity_id": "123456",
  "subdomain": "tu-cuenta"
}
```

## Configuración completa en n8n:

**Nodo HTTP Request:**
- **Method**: POST
- **URL**: `https://italicia-imagenes-kommo.un5bby.easypanel.host/process-url`
- **Authentication**: None
- **Send Body**: true
- **Body Content Type**: JSON
- **Body Parameters**:

### Opción 1: Solo subir imagen (sin adjuntar a entidad)

```
drive_url: https://drive-c.kommo.com
image_url: {{ $json.image_url }}
access_token: {{ $credentials.oAuth2Api.oauthTokenData.access_token }}
```

### Opción 2: Subir y adjuntar automáticamente a entidad

```
drive_url: https://drive-c.kommo.com
image_url: {{ $json.image_url }}
access_token: {{ $credentials.oAuth2Api.oauthTokenData.access_token }}
entity: leads
entity_id: {{ $json.lead_id }}
subdomain: {{ $json.subdomain }}
```

## Valores válidos para `entity`:

- `leads` - Para adjuntar a un lead
- `contacts` - Para adjuntar a un contacto
- `companies` - Para adjuntar a una empresa

## Valores para `drive_url` según región:

- **Brasil**: `https://drive-b.kommo.com`
- **EE.UU.**: `https://drive-c.kommo.com`
- **Europa**: `https://drive-e.kommo.com`

## Valores para `subdomain`:

El subdominio de tu cuenta de Kommo. Ejemplos:
- Si tu URL es `https://miempresa.kommo.com` → subdomain: `miempresa`
- Si tu URL es `https://miempresa.amocrm.com` → subdomain: `miempresa`

## Respuesta del microservicio:

### Sin adjuntar a entidad:

```json
{
  "success": true,
  "source": {
    "image_url": "https://ejemplo.com/imagen.jpg"
  },
  "file": {
    "name": "imagen.jpg",
    "size": 123456,
    "mime_type": "image/jpeg"
  },
  "kommo": {
    "session_uuid": "abc-123",
    "file_uuid": "xyz-789",
    "max_part_size": 524288,
    "session": { ... },
    "upload": { ... }
  },
  "attached": null
}
```

### Con adjunto a entidad:

```json
{
  "success": true,
  "source": {
    "image_url": "https://ejemplo.com/imagen.jpg"
  },
  "file": {
    "name": "imagen.jpg",
    "size": 123456,
    "mime_type": "image/jpeg"
  },
  "kommo": {
    "session_uuid": "abc-123",
    "file_uuid": "xyz-789",
    "max_part_size": 524288,
    "session": { ... },
    "upload": { ... }
  },
  "attached": {
    "entity": "leads",
    "entity_id": "123456",
    "file_uuid": "xyz-789"
  }
}
```

## Ejemplo completo de flujo en n8n:

### Paso 1: Obtener datos del lead/contacto
Usar el nodo de Kommo o HTTP Request para obtener el lead_id y otros datos.

### Paso 2: Subir imagen a Kommo Drive
Configurar nodo HTTP Request con:
```
URL: https://italicia-imagenes-kommo.un5bby.easypanel.host/process-url
Method: POST
Body:
{
  "image_url": "{{ $json.image_url }}",
  "drive_url": "https://drive-c.kommo.com",
  "access_token": "{{ $credentials.oAuth2Api.oauthTokenData.access_token }}",
  "entity": "leads",
  "entity_id": "{{ $json.lead_id }}",
  "subdomain": "tu-cuenta"
}
```

### Paso 3 (opcional): Enviar por WhatsApp
Si adjuntaste a la entidad, el archivo ya está disponible en el lead/contacto y puedes enviarlo por WhatsApp usando la API de Kommo.

## Notas importantes:

1. **El microservicio hace TODO automáticamente**:
   - Descarga la imagen desde la URL
   - La sube a Kommo Drive
   - Si proporcionas entity, entity_id y subdomain, la adjunta automáticamente

2. **Si el adjunto falla**, el archivo se sube igual a Kommo Drive y recibirás el `file_uuid` en la respuesta.

3. **El campo `attached`** en la respuesta te indica si el archivo fue adjuntado exitosamente a la entidad.

4. **No necesitas hacer llamadas adicionales** para adjuntar el archivo si usas los parámetros opcionales.
