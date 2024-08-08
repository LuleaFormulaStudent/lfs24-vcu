FROM node:16-bookworm

WORKDIR lfs-vcu

COPY package.json .
RUN npm install

COPY . .
RUN npm run gen-mavlink
RUN npm run build

CMD ["npm", "run", "prod"]
