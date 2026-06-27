#!/bin/bash
# deploy.sh — Полный деплой TMA Barbershop на сервер
# Использование: bash deploy.sh
set -e

PROJECT_DIR="/opt/tma-barbershop"
LOG_DIR="/tmp"

echo ""
echo "=============================================="
echo "  🚀 TMA Barbershop — Deploy Script"
echo "=============================================="
echo ""

cd "$PROJECT_DIR"

# 1. Git pull
echo "📦 Pulling latest changes from git..."
git pull origin main
echo "✅ Git pull done"
echo ""

# 2. Python зависимости
echo "🐍 Installing Python dependencies..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r backend/requirements.txt
echo "✅ Python deps installed"
echo ""

# 3. Фронтенд
echo "🏗️ Building frontend..."
cd frontend
npm ci --silent 2>/dev/null || npm install --silent
npm run build
cd ..
echo "✅ Frontend built"
echo ""

# 4. Останавливаем старые процессы
echo "🛑 Stopping old processes..."
pkill -f "uvicorn app.main:app" 2>/dev/null || echo "   (no uvicorn running)"
pkill -f cloudflared 2>/dev/null || echo "   (no cloudflared running)"
sleep 2
echo "✅ Old processes stopped"
echo ""

# 5. Запускаем backend
echo "🚀 Starting backend (uvicorn)..."
cd backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/barber-api.log" 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"
cd "$PROJECT_DIR"
sleep 2

# Проверяем, что запустился
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend started on port 8000"
else
    echo "❌ Backend failed to start. Check log: $LOG_DIR/barber-api.log"
    cat "$LOG_DIR/barber-api.log"
    exit 1
fi
echo ""

# 6. Запускаем Cloudflare Tunnel
echo "🔗 Starting Cloudflare Tunnel..."
nohup cloudflared tunnel --url http://localhost:8000 > "$LOG_DIR/cloudflared.log" 2>&1 &
TUNNEL_PID=$!
echo "   PID: $TUNNEL_PID"
# Ждём туннель и парсим URL
sleep 6
TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | head -1)
# fallback — если через короткое тире не нашли
if [ -z "$TUNNEL_URL" ]; then
  TUNNEL_URL=$(grep -oE 'https://[^ ]+\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | head -1)
fi

# 7. Авто-настройка Menu Button в Telegram боте (если нашли URL)
if [ -n "$TUNNEL_URL" ]; then
  echo "🔄 Setting BASE_URL for auto Menu Button config..."
  # Перезапускаем backend с BASE_URL, чтобы он сам настроил Menu Button
  # (или можно напрямую через API, но проще через рестарт)
  pkill -f "uvicorn app.main:app" 2>/dev/null || true
  sleep 1
  cd backend
  BASE_URL="$TUNNEL_URL" nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/barber-api.log" 2>&1 &
  BACKEND_PID=$!
  cd "$PROJECT_DIR"
  sleep 2
  echo "✅ Backend restarted with Menu Button targeting: $TUNNEL_URL"
fi

echo ""
echo "=============================================="
echo "  ✅ Deploy Complete!"
echo "=============================================="
echo ""
if [ -n "$TUNNEL_URL" ]; then
  echo "  📱 App URL:          $TUNNEL_URL"
  echo "  🔧 Admin panel:      ${TUNNEL_URL}#admin"
  echo "  🤖 Menu Button:      настроен автоматически"
  echo ""
  echo "  📋 Cron для напоминаний (добавьте в crontab -e):"
  echo "     0 * * * * curl -s ${TUNNEL_URL}/api/bookings/check-reminders > /dev/null 2>&1"
else
  echo "  📱 App URL:          (смотрите в логе ниже)"
  echo "  🔧 Admin panel:      #admin"
fi
echo "  📋 Logs:"
echo "     Backend:  tail -f $LOG_DIR/barber-api.log"
echo "     Tunnel:   tail -f $LOG_DIR/cloudflared.log"
echo "  📌 Stop:     pkill -f uvicorn; pkill -f cloudflared"
echo "=============================================="
echo ""
echo "ℹ️  Tunnel URL from log:"
grep -oE 'https://[^ ]+\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | head -1
echo ""
