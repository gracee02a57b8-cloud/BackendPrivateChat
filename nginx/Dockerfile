# Stage 1: Build Convayto frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend-convayto/package.json ./
RUN npm install
COPY frontend-convayto/ .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
# Copy built frontend
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080 8443
