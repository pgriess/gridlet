FROM node:16

WORKDIR /run

COPY package*.json .
COPY src src/
COPY test test/

RUN npm ci

ENTRYPOINT [ "node" ]
CMD [ "test/fake/enphase_server.js" ]
