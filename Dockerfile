FROM node:20-slim

# Enable non-free repository and install unrar
RUN echo "deb http://deb.debian.org/debian bookworm non-free non-free-firmware" >> /etc/apt/sources.list \
    && apt-get update && apt-get install -y \
    ffmpeg \
    unzip \
    unrar \
    p7zip-full \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "./dist/server/entry.mjs", "--host", "0.0.0.0"]