FROM node:16-bookworm

WORKDIR lfs-vcu

COPY package.json .
RUN npm install

COPY mavlink mavlink
RUN npm run gen-mavlink

COPY . .
RUN npm run build

CMD ["npm", "run", "prod"]
