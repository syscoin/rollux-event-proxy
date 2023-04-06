FROM node:19

RUN mkdir -p /var/api-gateway

WORKDIR /var/api-gateway
COPY ./package.json ./
RUN npm install
RUN npm install nodemon --global

COPY ./src ./src

EXPOSE 8080

CMD ["nodemon", "./src/index.js"]