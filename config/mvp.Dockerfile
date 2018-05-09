FROM node:carbon
WORKDIR /usr/src/bot

COPY .npmrc package*.json ./
RUN npm install

COPY . .
EXPOSE 8080

ENV NODE_ENV production
CMD [ "npm", "start" ]
