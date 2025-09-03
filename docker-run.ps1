# OtaBlog Docker Build and Run Script (Windows PowerShell)

Write-Host "🐳 OtaBlog Docker Setup" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker ishlamoqda" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker ishlamayapti. Docker Desktop ni ishga tushiring." -ForegroundColor Red
    exit 1
}

# Build Docker image
Write-Host "📦 Docker image yaratilmoqda..." -ForegroundColor Yellow
try {
    docker build -t otablog-backend .
    Write-Host "✅ Docker image muvaffaqiyatli yaratildi" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker image yaratishda xatolik" -ForegroundColor Red
    exit 1
}

# Remove existing container if exists
Write-Host "🧹 Mavjud container tozalanmoqda..." -ForegroundColor Yellow
docker stop otablog-api 2>$null
docker rm otablog-api 2>$null

# Run container
Write-Host "🚀 Container ishga tushirilmoqda..." -ForegroundColor Yellow
try {
    docker run -d `
        --name otablog-api `
        --env-file .env.docker `
        -p 5555:5555 `
        --restart unless-stopped `
        otablog-backend
    
    Write-Host "✅ Container muvaffaqiyatli ishga tushdi" -ForegroundColor Green
    Write-Host "🌐 Server: http://localhost:5555" -ForegroundColor Cyan
    Write-Host "💚 Health: http://localhost:5555/health" -ForegroundColor Cyan
    Write-Host "🏓 Ping: http://localhost:5555/ping" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Container ishga tushirishda xatolik" -ForegroundColor Red
    exit 1
}

# Show container status
Write-Host ""
Write-Host "📊 Container holati:" -ForegroundColor Yellow
docker ps --filter "name=otablog-api"

Write-Host ""
Write-Host "📋 Foydali buyruqlar:" -ForegroundColor Cyan
Write-Host "  Logs ko'rish:          docker logs otablog-api" -ForegroundColor White
Write-Host "  Live logs:             docker logs -f otablog-api" -ForegroundColor White
Write-Host "  Container to'xtatish:  docker stop otablog-api" -ForegroundColor White
Write-Host "  Container o'chirish:   docker rm otablog-api" -ForegroundColor White
Write-Host "  Image o'chirish:       docker rmi otablog-backend" -ForegroundColor White
Write-Host "  Shell ga kirish:       docker exec -it otablog-api sh" -ForegroundColor White
