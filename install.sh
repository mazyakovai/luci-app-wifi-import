#!/bin/sh

echo "[*] Инициализация установки luci-app-wifi-import..."
REPO_URL="https://githubusercontent.com"

# 1. Создаем правильные папки на роутере
mkdir -p /root
mkdir -p /usr/share/luci/menu.d
mkdir -p /www/luci-static/resources/view

# 2. Скачиваем файлы из репозитория в систему роутера
echo "[*] Скачивание компонентов интерфейса..."
wget -q -O /root/update_wifi.sh "${REPO_URL}/root/root/update_wifi.sh"
wget -q -O /usr/share/luci/menu.d/luci-app-wifi-import.json "${REPO_URL}/root/usr/share/luci/menu.d/luci-app-wifi-import.json"
wget -q -O /www/luci-static/resources/view/wifi_import.js "${REPO_URL}/root/www/luci-static/resources/view/wifi_import.js"

# 3. Выставляем права на исполнение скрипту автоматизации
chmod +x /root/update_wifi.sh

# 4. Перезапускаем кэш веб-интерфейса LuCI
echo "[*] Обновление кэша LuCI..."
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache

echo "=== [УСПЕХ] Плагин успешно установлен! Обновите страницу OpenWrt. ==="
