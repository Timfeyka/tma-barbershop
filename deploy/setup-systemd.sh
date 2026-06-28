#!/bin/bash
# setup-systemd.sh — Установить systemd сервисы для TMA Barbershop
# Запускать на сервере один раз после первого git pull.
# Использование: bash setup-systemd.sh

set -e

PROJECT_DIR="/opt/tma-barbershop"
DEPLOY_DIR="$PROJECT_DIR/deploy"

echo "=============================================="
echo "  🛠 Установка systemd сервисов"
echo "=============================================="
echo ""

# Убеждаемся, что скрипты есть
if [ ! -f "$DEPLOY_DIR/barbershop-api.service" ]; then
    echo "❌ Файлы сервисов не найдены в $DEPLOY_DIR"
    echo "   Убедитесь, что deploy присутствует в проекте"
    exit 1
fi

# Устанавливаем API сервис
echo "📄 Установка barbershop-api.service..."
cp "$DEPLOY_DIR/barbershop-api.service" /etc/systemd/system/barbershop-api.service
echo "   ✅ API service installed"

# Устанавливаем Tunnel сервис
echo "📄 Установка barbershop-tunnel@.service..."
cp "$DEPLOY_DIR/barbershop-tunnel@.service" /etc/systemd/system/barbershop-tunnel@.service
echo "   ✅ Tunnel service installed"

# Перезагружаем systemd
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload
echo "   ✅ Done"

# Включаем автозапуск
echo "🔌 Enabling services..."
systemctl enable barbershop-api.service
systemctl enable barbershop-tunnel@main.service
echo "   ✅ Services enabled"

echo ""
echo "=============================================="
echo "  ✅ Setup Complete!"
echo "=============================================="
echo ""
echo "  Доступные команды:"
echo "    systemctl start  barbershop-api"
echo "    systemctl stop   barbershop-api"
echo "    systemctl status barbershop-api"
echo "    journalctl -u barbershop-api -n 50 -f"
echo ""
echo "    systemctl start  barbershop-tunnel@main"
echo "    systemctl stop   barbershop-tunnel@main"
echo "    systemctl status barbershop-tunnel@main"
echo "    journalctl -u barbershop-tunnel@main -n 50 -f"
echo ""
echo "  🚀 Для деплоя: bash deploy.sh"
echo "=============================================="
