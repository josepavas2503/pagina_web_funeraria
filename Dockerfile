# 1. Imagen base liviana de Node.js
FROM node:18-alpine

# 2. Crear carpeta de trabajo en el contenedor
WORKDIR /app

# 3. Copiar archivos de dependencias
COPY package*.json ./

# 4. Instalar dependencias
RUN npm install --production

# 5. Copiar el resto del proyecto (server.js, carpeta public/, etc.)
COPY . .

# 6. Exponer el puerto
EXPOSE 3000

# 7. Comando de inicio del servidor
CMD ["node", "server.js"]