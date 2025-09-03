# 🐳 OtaBlog Docker Setup

## Docker bilan ishga tushirish

### Tez boshlash

**Windows PowerShell:**
```powershell
.\docker-run.ps1
```

**Linux/Mac:**
```bash
chmod +x docker-run.sh
./docker-run.sh
```

### Manual setup

1. **Environment faylini tayyorlang:**
   ```bash
   cp .env.example .env.docker
   # .env.docker faylida o'z ma'lumotlaringizni kiriting
   ```

2. **Docker image yaratish:**
   ```bash
   docker build -t otablog-backend .
   ```

3. **Container ishga tushirish:**
   ```bash
   docker run -d \
     --name otablog-api \
     --env-file .env.docker \
     -p 5555:5555 \
     --restart unless-stopped \
     otablog-backend
   ```

### Docker Compose bilan

**Development uchun (MongoDB bilan):**
```bash
docker-compose up -d
```

**Production uchun (faqat API):**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Foydali buyruqlar

### Container boshqaruvi
```bash
# Container holati
docker ps

# Logs ko'rish
docker logs otablog-api

# Live logs
docker logs -f otablog-api

# Container ichiga kirish
docker exec -it otablog-api sh

# Container to'xtatish
docker stop otablog-api

# Container o'chirish
docker rm otablog-api

# Image o'chirish
docker rmi otablog-backend
```

### Health check
```bash
# Basic ping
curl http://localhost:5555/ping

# Health status
curl http://localhost:5555/health

# Simple health
curl http://localhost:5555/healthz
```

## Docker Specifications

- **Base Image:** node:18-alpine
- **Port:** 5555
- **Health Check:** /healthz endpoint
- **User:** Non-root (otablog:nodejs)
- **Restart Policy:** unless-stopped

## Environment Variables

Kerakli environment variables:
- `MONGODB_USERNAME`
- `MONGODB_PASSWORD`
- `JWT_SECRET`
- `NODE_ENV=production`
- `PORT=5555`
- `HOST=0.0.0.0`

## Xavfsizlik

✅ Non-root user  
✅ Alpine Linux (minimal attack surface)  
✅ Environment secrets  
✅ Health checks  
✅ Proper signal handling  

## Production deployment

Coolify yoki boshqa container platformalar uchun:

1. `Dockerfile` ni ishlataylik
2. Environment variables ni platform orqali o'rnataylik
3. Health check endpoint: `/healthz`
4. Port: `5555`

## Troubleshooting

**Container ishlamayapti:**
```bash
docker logs otablog-api
```

**Health check fail:**
```bash
curl http://localhost:5555/debug/info
```

**Environment variables:**
```bash
docker exec otablog-api env
```
