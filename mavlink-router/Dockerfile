FROM node:16-bookworm

WORKDIR mavlink-router

COPY .git-credentials .
RUN git config --global credential.helper 'store --file .git-credentials'

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "run", "prod"]
