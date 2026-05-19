# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm i

# Copy source code
COPY . .

RUN npm run lint

# Build the application
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy nginx config (optional - for SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
