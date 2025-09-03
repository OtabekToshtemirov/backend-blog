# Node.js 18 Alpine image - kichik va tez
FROM node:18-alpine

# Metadata qo'shish
LABEL maintainer="Otabek Toshtemirov"
LABEL description="OtaBlog API Backend Server"
LABEL version="1.0.0"

# Working directory belgilash
WORKDIR /usr/src/app

# Security: non-root user yaratish
RUN addgroup -g 1001 -S nodejs && \
    adduser -S otablog -u 1001

# Package files ni avval copy qilish (caching uchun)
COPY package*.json ./

# Sharp va native dependencies uchun build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && npm ci --only=production \
    && apk del python3 make g++

# Application fayllarini copy qilish
COPY . .

# Non-root user ga o'tish
RUN chown -R otablog:nodejs /usr/src/app
USER otablog

# Port expose qilish
EXPOSE 5555

# Health check qo'shish
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5555/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start command
CMD ["node", "index.js"]
