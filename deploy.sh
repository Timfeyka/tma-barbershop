#!/bin/bash
# deploy.sh — Полный деплой TMA Barbershop на сервер
# Использование: bash deploy.sh
set -e

PROJECT_DIR="/opt/tma-barbershop"
VENV_DIR="$PROJECT_DIR/venv"
API_SERVICE="barbershop-api"
TUNNEL_SERVICE="barbershop-tunnel@main"

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
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
pip install -q -r backend/requirements.txt
echo "✅ Python deps installed"
echo ""

# 3. Фронтенд
echo "🏗️ Building frontend..."
cd frontend
npm ci --silent 2>/dev/null || npm install --silent
npm run build
cd "$PROJECT_DIR"
echo "✅ Frontend built"
echo ""

# 4. Останавливаем туннель (без restart — API перезапустится сам)
echo "🛑 Stopping Cloudflare Tunnel..."
systemctl stop "$TUNNEL_SERVICE" 2>/dev/null || echo "   (tunnel not running)"
sleep 1
echo "✅ Tunnel stopped"
echo ""

# 5. Запускаем API через systemd (если ещё не запущен)
echo "🚀 Starting API service..."
systemctl daemon-reload 2>/dev/null || true
systemctl enable "$API_SERVICE" 2>/dev/null || true
systemctl restart "$API_SERVICE" 2>/dev/null || {
    # Если systemd нет (локально), fallback на nohup
    echo "   ⚠️ systemctl не найден, запускаем через nohup..."
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    sleep 1
    cd backend
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/barber-api.log 2>&1 &
    cd "$PROJECT_DIR"
    echo "   ✅ Backend started (PID: $!)"
}
echo ""

# 6. Запускаем Cloudflare Tunnel
echo "🔗 Starting Cloudflare Tunnel..."
systemctl restart "$TUNNEL_SERVICE" 2>/dev/null || {
    echo "   ⚠️ systemctl не найден, запускаем через nohup..."
    nohup cloudflared tunnel --url http://localhost:8000 > /tmp/cloudflared.log 2>&1 &
}
sleep 6
echo ""

# 7. Извлекаем URL туннеля
echo "🔍 Looking up tunnel URL..."
TUNNEL_URL=""
# Сначала через journald (systemd)
if command -v journalctl &>/dev/null; then
    TUNNEL_URL=$(journalctl -u "$TUNNEL_SERVICE" -n 200 --no-pager 2>/dev/null | \
        grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1)
fi
# Fallback: через лог-файл (nohup)
if [ -z "$TUNNEL_URL" ]; then
    if [ -f /tmp/cloudflared.log ]; then
        TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1)
    fi
fi

# Если нашли URL — обновляем ENV и рестартуем API с BASE_URL
if [ -n "$TUNNEL_URL" ]; then
    echo "   ✅ Tunnel URL: $TUNNEL_URL"
    echo "🔄 Setting BASE_URL for Menu Button config..."

    # Обновляем .env файл (чтобы при старте systemd подхватил)
    ENV_FILE="$PROJECT_DIR/backend/.env"
    if grep -q "^BASE_URL=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|" "$ENV_FILE"
    else
        echo "BASE_URL=$TUNNEL_URL" >> "$ENV_FILE"
    fi

    # Обновляем переменную и рестартуем
    if command -v systemctl &>/dev/null; then
        systemctl set-environment BASE_URL="$TUNNEL_URL"
        systemctl restart "$API_SERVICE"
    else
        pkill -f "uvicorn app.main:app" 2>/dev/null || true
        sleep 1
        cd backend
        BASE_URL="$TUNNEL_URL" nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/barber-api.log 2>&1 &
        cd "$PROJECT_DIR"
    fi
    echo "✅ Backend restarted with Menu Button targeting: $TUNNEL_URL"
else
    echo "   ⚠️ Could not extract tunnel URL — Menu Button not updated"
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
echo ""
echo "  📋 Статус сервисов:"
echo "     systemctl status $API_SERVICE"
echo "     systemctl status $TUNNEL_SERVICE"
echo "  📋 Логи:"
echo "     journalctl -u $API_SERVICE -n 50 --no-pager"
echo "     journalctl -u $TUNNEL_SERVICE -n 50 --no-pager"
echo ""
echo "=============================================="
echo ""
