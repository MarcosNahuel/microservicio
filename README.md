# Microservicio de Subida de Imagenes

Este proyecto expone un microservicio en Node.js que recibe archivos mediante POST /upload, los almacena en /var/www/public/images y responde con la URL publica lista para que n8n la procese.

## Configuracion rapida (local)
1. Instala dependencias: npm install
2. Define la URL base:
   - Windows (PowerShell): setx PUBLIC_BASE_URL http://localhost:3000
   - Linux/macOS: export PUBLIC_BASE_URL=http://localhost:3000
3. Ejecuta: npm start
4. Prueba: curl -F "image=@ruta/archivo.jpg" http://localhost:3000/upload

## Estructura
- server.js: Servicio Express + Multer.
- package.json: Dependencias y scripts.
- nginx/microservicio.conf: Bloque Nginx listo para Ubuntu/Hostinger.

## Despliegue en Hostinger (Ubuntu 22.04)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git build-essential
sudo npm install -g pm2

sudo mkdir -p /var/www/microservicio
sudo mkdir -p /var/www/public/images
sudo chown -R $USER:$USER /var/www/microservicio
sudo chown -R $USER:$USER /var/www/public
sudo chmod 755 /var/www/public /var/www/public/images

cd /var/www/microservicio
git clone https://github.com/tuusuario/microservicio.git .
npm install

PUBLIC_BASE_URL=https://tuservicio.com pm2 start server.js --name microservicio-uploads --update-env
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save

sudo tee /etc/nginx/sites-available/microservicio < nginx/microservicio.conf
sudo ln -sf /etc/nginx/sites-available/microservicio /etc/nginx/sites-enabled/microservicio
sudo nginx -t
sudo systemctl reload nginx

## Certificado SSL (opcional)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tuservicio.com -d www.tuservicio.com
sudo certbot renew --dry-run

## Notas
- Ajusta PUBLIC_BASE_URL al dominio publico en produccion.
- Respaldar /var/www/public/images periodicamente.
