FROM node:19

RUN mkdir -p /var/data-collector


WORKDIR /var/data-collector
COPY ./package.json ./
RUN npm install
RUN npm install nodemon --global

COPY ./src ./src

CMD ["nodemon", "./src/index.js"]