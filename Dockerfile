# Usa una imagen base oficial de Node.js ligera y segura
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Crear usuario no root para mayor seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copia el resto del código de la aplicación
COPY . .

# Cambiar a usuario no root
USER nodejs

# Expone el puerto en el que corre la aplicación
EXPOSE 3000

# El comando para iniciar la aplicación cuando el contenedor arranque
CMD ["node", "server.js"]