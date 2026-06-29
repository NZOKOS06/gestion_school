FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY src ./src
COPY start.sh ./start.sh

RUN chmod +x ./start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["./start.sh"]
