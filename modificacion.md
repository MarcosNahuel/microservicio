{
  "package.json": {
    "name": "kommo-drive-uploader",
    "version": "1.0.0",
    "description": "Microservicio para subir archivos a Kommo Drive",
    "main": "server.js",
    "scripts": {
      "start": "node server.js",
      "dev": "nodemon server.js",
      "test": "node test-upload.js"
    },
    "dependencies": {
      "express": "^4.18.2",
      "axios": "^1.6.0",
      "multer": "^1.4.5-lts.1",
      "form-data": "^4.0.0",
      "dotenv": "^16.3.1"
    },
    "devDependencies": {
      "nodemon": "^3.0.1"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  },

  "Dockerfile": "FROM node:18-alpine\n\nWORKDIR /app\n\nCOPY package*.json ./\n\nRUN npm ci --only=production\n\nCOPY server.js .\n\nEXPOSE 3000\n\nENV NODE_ENV=production\n\nUSER node\n\nCMD [\"node\", \"server.js\"]",

  "docker-compose.yml": "version: '3.8'\n\nservices:\n  kommo-uploader:\n    build: .\n    ports:\n      - \"3000:3000\"\n    environment:\n      - PORT=3000\n      - KOMMO_API_KEY=${KOMMO_API_KEY}\n      - NODE_ENV=production\n    restart: unless-stopped\n    healthcheck:\n      test: [\"CMD\", \"wget\", \"--quiet\", \"--tries=1\", \"--spider\", \"http://localhost:3000/health\"]\n      interval: 30s\n      timeout: 10s\n      retries: 3\n      start_period: 40s\n    logging:\n      driver: json-file\n      options:\n        max-size: \"10m\"\n        max-file: \"3\"",

  ".env.example": "# Puerto del servidor\nPORT=3000\n\n# Token de acceso de Kommo (opcional si se envía en cada request)\nKOMMO_API_KEY=tu_token_aqui\n\n# Ambiente\nNODE_ENV=production",

  "test-upload.js": "// Script para probar el microservicio\nconst axios = require('axios');\n\nasync function testUpload() {\n  try {\n    console.log('Probando upload...');\n    \n    const response = await axios.post('http://localhost:3000/upload', {\n      image_url: 'https://picsum.photos/800/600',\n      access_token: 'TU_TOKEN_AQUI'\n    });\n\n    console.log('✅ Upload exitoso:');\n    console.log(JSON.stringify(response.data, null, 2));\n  } catch (error) {\n    console.error('❌ Error:', error.response?.data || error.message);\n  }\n}\n\ntestUpload();",

  "nginx.conf": "server {\n    listen 80;\n    server_name tu-dominio.com;\n\n    # Redirigir a HTTPS\n    return 301 https://$server_name$request_uri;\n}\n\nserver {\n    listen 443 ssl http2;\n    server_name tu-dominio.com;\n\n    # Certificados SSL (Let's Encrypt)\n    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;\n\n    # Configuración SSL segura\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_ciphers HIGH:!aNULL:!MD5;\n    ssl_prefer_server_ciphers on;\n\n    # Límites para uploads grandes\n    client_max_body_size 100M;\n    client_body_timeout 300s;\n\n    location / {\n        proxy_pass http://localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_cache_bypass $http_upgrade;\n        \n        # Timeouts para uploads\n        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_read_timeout 300s;\n    }\n}",

  "README.md": "# Kommo Drive Uploader Microservice\n\n## Instalación Local\n\n```bash\nnpm install\ncp .env.example .env\n# Editar .env con tus credenciales\nnpm run dev\n```\n\n## Deployment en VPS\n\n### Opción 1: Con Docker\n\n```bash\n# Clonar repositorio\ngit clone [tu-repo]\ncd kommo-drive-uploader\n\n# Configurar variables de entorno\ncp .env.example .env\nnano .env\n\n# Build y correr\ndocker-compose up -d\n\n# Ver logs\ndocker-compose logs -f\n```\n\n### Opción 2: Con PM2 (Node.js directo)\n\n```bash\n# Instalar dependencias\nnpm install --production\n\n# Instalar PM2 globalmente\nnpm install -g pm2\n\n# Iniciar servicio\npm2 start server.js --name kommo-uploader\n\n# Hacer que se inicie al bootear\npm2 startup\npm2 save\n\n# Ver logs\npm2 logs kommo-uploader\n```\n\n### Opción 3: Con systemd\n\n```bash\n# Crear servicio\nsudo nano /etc/systemd/system/kommo-uploader.service\n```\n\n```ini\n[Unit]\nDescription=Kommo Drive Uploader\nAfter=network.target\n\n[Service]\nType=simple\nUser=www-data\nWorkingDirectory=/var/www/kommo-uploader\nExecStart=/usr/bin/node server.js\nRestart=on-failure\nEnvironment=PORT=3000\nEnvironment=NODE_ENV=production\nEnvironmentFile=/var/www/kommo-uploader/.env\n\n[Install]\nWantedBy=multi-user.target\n```\n\n```bash\n# Habilitar e iniciar\nsudo systemctl enable kommo-uploader\nsudo systemctl start kommo-uploader\nsudo systemctl status kommo-uploader\n```\n\n## Configuración de Nginx\n\n```bash\n# Copiar configuración\nsudo cp nginx.conf /etc/nginx/sites-available/kommo-uploader\nsudo ln -s /etc/nginx/sites-available/kommo-uploader /etc/nginx/sites-enabled/\n\n# Obtener certificado SSL\nsudo certbot --nginx -d tu-dominio.com\n\n# Recargar nginx\nsudo nginx -t\nsudo systemctl reload nginx\n```\n\n## Uso desde n8n\n\nVer n8n-config.json para la configuración del nodo HTTP Request\n\n## API Endpoints\n\n### POST /upload\nSube un archivo desde una URL\n\n**Body:**\n```json\n{\n  \"image_url\": \"https://example.com/image.jpg\",\n  \"access_token\": \"tu_token_oauth2\"\n}\n```\n\n**Response:**\n```json\n{\n  \"success\": true,\n  \"file_id\": \"abc123\",\n  \"file_name\": \"image.jpg\",\n  \"file_size\": 123456,\n  \"session_id\": \"xyz789\",\n  \"drive_url\": \"https://drive-c.amocrm.com\"\n}\n```\n\n### POST /upload-file\nSube un archivo directo (multipart/form-data)\n\n**Form Data:**\n- `file`: archivo binario\n- `access_token`: token OAuth2\n- `account_subdomain`: subdomain de Kommo (opcional)\n\n### GET /health\nHealth check del servicio\n\n## Seguridad\n\n- Usar HTTPS en producción\n- Impl