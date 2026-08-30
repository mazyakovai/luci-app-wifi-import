#!/bin/sh

echo "[*] Инициализация установки luci-app-wifi-import..."
REPO_URL="https://raw.githubusercontent.com/mazyakovai/luci-app-wifi-import/main"

# 1. Создаем необходимые системные директории внутри роутера
mkdir -p /usr/share/luci/menu.d
mkdir -p /www/luci-static/resources/view

# 2. Скачиваем компоненты интерфейса напрямую по их честным адресам
echo "[*] Скачивание компонентов интерфейса (без кэша)..."
wget -q -O /usr/share/luci/menu.d/luci-app-wifi-import.json "${REPO_URL}/root/usr/share/luci/menu.d/luci-app-wifi-import.json"
wget -q -O /www/luci-static/resources/view/wifi_import.js "${REPO_URL}/root/www/luci-static/resources/view/wifi_import.js"

# 3. Полностью очищаем кэш LuCI и перезапускаем веб-сервер
echo "[*] Обновление кэша LuCI..."
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache

echo "=== [УСПЕХ] Плагин успешно установлен! Обновите страницу OpenWrt. ==="
