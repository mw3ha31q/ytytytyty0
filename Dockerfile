FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

# CMD ["node", "./dist/server/entry.mjs"]
CMD ["node", "./dist/server/entry.mjs", "--host", "0.0.0.0"]