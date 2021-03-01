FROM node:14-buster

WORKDIR /workdir

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

RUN npm install

COPY . .

EXPOSE 10412

CMD npm start
