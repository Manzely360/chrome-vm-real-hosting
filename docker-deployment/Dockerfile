FROM node:18-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY docker-service.js .

EXPOSE 3002

CMD ["node", "docker-service.js"]
