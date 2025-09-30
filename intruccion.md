# 🔄 Pasos para Actualizar tu Microservicio

## 1. Instalar Nueva Dependencia
```bash
npm install axios
```

## 2. Reemplazar server.js
Reemplaza completamente tu `server.js` actual con el código del artifact anterior.

## 3. Elegir Estrategia

### **Opción A: n8n descarga → Microservicio sube** (usar endpoint `/upload`)
- **Ventaja**: Más control en n8n
- **Desventaja**: Más tráfico de red
- **Flujo n8n**: Como lo tienes ahora (6 nodos)

### **Opción B: Microservicio hace todo** (usar endpoint `/process-url`) ⭐ RECOMENDADO
- **Ventaja**: Más eficiente, menos nodos en n8n
- **Desventaja**: Menos visibilidad del proceso en n8n
- **Flujo n8n**: Solo 3-4 nodos

## 4. Configuración n8n según la opción elegida

### Si eliges Opción A (/upload con binario):
```javascript
// Nodo 5: Code in JavaScript (tu código actual está bien)
const metadataNode = $('3. Compute File Metadata').item;
const accountNode = items[0];

let driveUrl = accountNode.json.drive_url || 'https://drive-c.kommo.com';
driveUrl = driveUrl.replace('.amocrm.com', '.kommo.com');

const credentials = await this.getCredentials('oAuth2Api');
const accessToken = credentials.oauthTokenData.access_token;

return [{
  json: {
    drive_url: driveUrl,
    access_token: accessToken,
    file_name: metadataNode.json.file_name,
    file_size: metadataNode.json.file_size
  },
  binary: metadataNode.binary
}];
```

**Nodo 6: HTTP Request**
- Method: `POST`
- URL: `https://tu-microservicio.com/upload`
- Body: `multipart-form-data`
- Parameters:
  - `image` (binary): `data`
  - `drive_url`: `{{ $json.drive_url }}`
  - `access_token`: `{{ $json.access_token }}`

### Si eliges Opción B (/process-url sin binario): ⭐ RECOMENDADO
```javascript
// FLUJO SIMPLIFICADO - Solo 3 nodos necesarios

// Nodo 1: Extract Image URL (mantén tu código actual)

// Nodo 2: Get Account Info (mantén tu configuración actual)

// Nodo 3: Code - Preparar request
const imageUrl = $('1. Extract Image URL').item.json.image_url;
const accountNode = items[0];

let driveUrl = accountNode.json.drive_url || 'https://drive-c.kommo.com';
driveUrl = driveUrl.replace('.amocrm.com', '.kommo.com');

const credentials = await this.getCredentials('oAuth2Api');

return [{
  json: {
    image_url: imageUrl,
    drive_url: driveUrl,
    access_token: credentials.oauthTokenData.access_token
  }
}];

// Nodo 4: HTTP Request
// Method: POST
// URL: https://tu-microservicio.com/process-url
// Body: JSON
// JSON Body: 
// {
//   "image_url": "{{ $json.image_url }}",
//   "drive_url": "{{ $json.drive_url }}",
//   "access_token": "{{ $json.access_token }}"
// }
```

## 5. Actualizar y Desplegar

### Si usas Docker:
```bash
# Rebuild
docker build -t kommo-upload-service .
docker stop kommo-upload
docker rm kommo-upload
docker run -d --name kommo-upload -p 3000:3000 kommo-upload-service
```

### Si usas PM2:
```bash
pm2 restart microservicio-uploads
pm2 logs microservicio-uploads
```

## 6. Probar el Microservicio

### Test Opción A (con archivo):
```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@test.jpg" \
  -F "drive_url=https://drive-c.kommo.com" \
  -F "access_token=TU_TOKEN"
```

### Test Opción B (con URL):
```bash
curl -X POST http://localhost:3000/process-url \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://cdn.shopify.com/s/files/1/0001/2345/products/test.jpg",
    "drive_url": "https://drive-c.kommo.com",
    "access_token": "TU_TOKEN"
  }'
```

## 7. Verificar Logs
```bash
# Ver logs en tiempo real
docker logs -f kommo-upload
# o
pm2 logs microservicio-uploads
```

## ⚠️ Cambios Importantes

### Tu microservicio actual:
- ❌ Guarda imágenes en `/var/www/public/images`
- ❌ Devuelve URL de tu servidor
- ❌ No se comunica con Kommo

### Microservicio actualizado:
- ✅ NO guarda nada localmente
- ✅ Sube directamente a Kommo Drive API
- ✅ Devuelve UUID y metadata de Kommo
- ✅ Maneja el tamaño exacto para evitar error 409
- ✅ Soporta upload multi-part para archivos grandes

## 🎯 Resumen

**Tu problema**: Error 409 porque n8n agrega bytes extras al enviar binarios.

**La solución**: El microservicio usa axios que envía exactamente los bytes declarados.

**Recomendación**: Usa la **Opción B** (`/process-url`) porque:
1. Menos nodos en n8n (3 vs 6)
2. Menos tráfico de red
3. Más rápido
4. Más simple de mantener

## 📊 Comparación de Flujos

### Flujo Actual (6+ nodos):
```
Extract URL → Download → Compute Metadata → Get Account → Prepare → Upload
```

### Flujo Optimizado (3 nodos):
```
Extract URL → Get Account → Call Microservice
```

El microservicio se encarga de descargar, calcular tamaño y subir.