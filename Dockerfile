# Dockerfile para la aplicación SIMCEP-EP

# Usamos una imagen base de Node.js
FROM node:18-slim

# [NUEVO] Instalamos las herramientas necesarias para compilar bcrypt
RUN apt-get update && apt-get install -y build-essential python && rm -rf /var/lib/apt/lists/*

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de configuración de nuestro proyecto
COPY package*.json ./

# Instalamos las dependencias (ahora bcrypt se instalará correctamente)
RUN npm install --production

# Copiamos el resto de los archivos de la aplicación
COPY . .

# El comando para iniciar la aplicación
CMD ["node", "server.js"]