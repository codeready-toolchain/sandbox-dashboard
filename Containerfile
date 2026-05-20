FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM registry.access.redhat.com/ubi9/nginx-124
COPY --from=build /app/dist .
COPY nginx.conf "${NGINX_CONF_PATH}"
CMD nginx -g "daemon off;"
