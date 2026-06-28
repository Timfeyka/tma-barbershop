#!/bin/bash
# extract-tunnel-url.sh — Извлечь URL Cloudflare Tunnel из лога systemd
# Использование: ./extract-tunnel-url.sh [journal-id]
set -e

SERVICE="${1:-barbershop-tunnel@main}"

# Пробуем достать URL из последних записей journald
URL=$(journalctl -u "$SERVICE" -n 200 --no-pager 2>/dev/null | \
  grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1)

echo "$URL"
