# Imagen de producción: compila Angular + servidor y sirve todo desde Node.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server --include-workspace-root=false
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/data/sample-news.json server/data/
COPY --from=build /app/web/dist web/dist
COPY content content
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
