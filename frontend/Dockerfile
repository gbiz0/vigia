FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
