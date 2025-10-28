# Dockerfile para la aplicación SIMCEP-EP

# Usamos una imagen base de Node.js
FROM node:18-slim

# Instalamos las herramientas necesarias, usando 'python3'
RUN apt-get update && apt-get install -y build-essential python3 && rm -rf /var/lib/apt/lists/*

# [NUEVA LÍNEA] Creamos el directorio donde Fly.io montará el volumen persistente.
# Esto asegura que el directorio de destino exista antes del montaje.
RUN mkdir /data

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de configuración de nuestro proyecto
COPY package*.json ./

# Instalamos las dependencias
RUN npm install --production

# Copiamos el resto de los archivos de la aplicación
COPY . .

# El comando para iniciar la aplicación
CMD ["node", "server.js"]