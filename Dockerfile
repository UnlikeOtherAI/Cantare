# Web app + background-generation server in one small image.
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8790 STATIC_DIR=/app/dist
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 8790
USER node
CMD ["node", "server/index.ts"]
