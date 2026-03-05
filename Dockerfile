# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies zuerst (Docker-Cache nutzen)
COPY package.json package-lock.json* ./
RUN npm ci

# Source kopieren und bauen
COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────
FROM nginx:alpine

# Eigene nginx-Config (SPA routing + Uptime Kuma Proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build-Artefakte aus Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
