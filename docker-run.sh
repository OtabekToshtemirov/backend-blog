#!/bin/bash

# OtaBlog Docker Build and Run Script

echo "🐳 OtaBlog Docker Setup"
echo "======================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker ishlamayapti. Docker Desktop ni ishga tushiring."
    exit 1
fi

print_success "Docker ishlamoqda"

# Build Docker image
echo "📦 Docker image yaratilmoqda..."
if docker build -t otablog-backend .; then
    print_success "Docker image muvaffaqiyatli yaratildi"
else
    print_error "Docker image yaratishda xatolik"
    exit 1
fi

# Run container
echo "🚀 Container ishga tushirilmoqda..."
if docker run -d \
    --name otablog-api \
    --env-file .env.docker \
    -p 5555:5555 \
    --restart unless-stopped \
    otablog-backend; then
    print_success "Container muvaffaqiyatli ishga tushdi"
    echo "🌐 Server: http://localhost:5555"
    echo "💚 Health: http://localhost:5555/health"
    echo "🏓 Ping: http://localhost:5555/ping"
else
    print_error "Container ishga tushirishda xatolik"
    exit 1
fi

# Show container status
echo ""
echo "📊 Container holati:"
docker ps --filter "name=otablog-api"

echo ""
echo "📋 Foydali buyruqlar:"
echo "  Logs ko'rish:          docker logs otablog-api"
echo "  Container to'xtatish:  docker stop otablog-api"
echo "  Container o'chirish:   docker rm otablog-api"
echo "  Image o'chirish:       docker rmi otablog-backend"
