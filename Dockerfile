FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN cd frontend && npm install && cd ../backend && npm install --omit=dev

COPY frontend frontend
COPY backend backend

RUN cd frontend && npm run build

EXPOSE 3000
CMD ["node", "backend/server.js"]
