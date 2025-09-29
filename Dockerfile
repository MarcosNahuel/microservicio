# Usa una imagen base oficial de Node.js
FROM node:20-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Crea el directorio de uploads y asigna permisos al usuario 'node'
# Es importante hacerlo antes de cambiar de usuario
RUN mkdir -p /var/www/public/images && chown -R node:node /var/www/public

# Copia los archivos de dependencias
COPY --chown=node:node package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código de la aplicación, asignando permisos
COPY --chown=node:node . .

# Expone el puerto que la aplicación usará
EXPOSE 3000

# Cambia al usuario no-root por seguridad
USER node

# El comando para iniciar la aplicación
CMD ["node", "server.js"]
