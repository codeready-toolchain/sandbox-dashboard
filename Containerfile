FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM registry.access.redhat.com/ubi9/nginx-124
COPY --from=build /app/dist .
COPY deploy/nginx/nginx.conf "${NGINX_CONF_PATH}"
COPY deploy/nginx/security-headers.conf /etc/nginx/security-headers.conf
CMD nginx -g "daemon off;"
