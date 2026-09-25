FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/server/dist ./server/dist
COPY web ./web
ENV CLIENT_DIST=../../web
ENV TRUST_PROXY=true
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
