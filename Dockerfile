FROM node:22-alpine

WORKDIR /app
COPY package.json README.md ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY data/seed.json ./data/seed.json

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
