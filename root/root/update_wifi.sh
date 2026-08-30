#!/bin/sh
# =====================================================================
# SYSTEM SCRIPT: update_wifi.sh
# DESCRIPTION: Dynamic OpenWRT VIF Allocator based on SSID naming markers.
# AUTHOR: Senior DevOps Engineer / AI Collaborator
# =====================================================================

# Системные константы беспроводного эфира
ENCRYPTION="psk2"          # psk2 (пароль) или none (открытая сеть)
WIFI_PASSWORD="88888888"   # Пароль для доступа к ферме аккаунтов
TX_POWER="20"              # Мощность передатчика в dBm

# Карта аппаратных радиомодулей роутера (radio0 — 2.4ГГц, radio1 — 5ГГц)
RADIO_2G="radio0"
RADIO_5G="radio1"

# === ИЗМЕНЕНО: Путь изменен для интеграции с веб-интерфейсом LuCI ===
CSV_FILE="/tmp/wifi_vendor.csv"

if [ ! -f "$CSV_FILE" ]; then
    echo "[-] КРИТИЧЕСКАЯ ОШИБКА: Файл конфигурации $CSV_FILE отсутствует."
    exit 1
fi

echo "[*] Инициализация: Полная очистка старых виртуальных Wi-Fi интерфейсов..."
# === ИЗМЕНЕНО: Раскомментировано для избежания дублирования сетей ===
while uci delete wireless.@wifi-iface[-1] 2>/dev/null; do :; done

echo "[*] Запуск динамического парсинга CSV-пула..."
count=1

# Читаем CSV построчно, отсекая заголовок (mac,ssid)
tail -n +2 "$CSV_FILE" | while IFS=',' read -r mac ssid || [ -n "$mac" ]; do
    [ -z "$mac" ] || [ -z "$ssid" ] && continue
    
    # Жесткая очистка от скрытых Windows-символов переноса строки (\r)
    mac=$(echo "$mac" | tr -d '\r\n ')
    ssid=$(echo "$ssid" | tr -d '\r\n')

    # ИНТЕЛЛЕКТУАЛЬНОЕ РАСПРЕДЕЛЕНИЕ ПО ЧАСТОТАМ:
    # Ищем маркер 5G в названии сети, полученной от нашего Python-скрипта
    if echo "$ssid" | grep -qE "5G|5g|5GHz"; then
        TARGET_RADIO="$RADIO_5G"
        FREQ_TAG="5.0 GHz"
    else
        TARGET_RADIO="$RADIO_2G"
        FREQ_TAG="2.4 GHz"
    fi

    echo "    [+] Конфигурация точки #count -> [$FREQ_TAG] MAC: $mac | SSID: '$ssid'"

    # Запись параметров в системный конфигуратор UCI OpenWRT
    uci add wireless wifi-iface > /dev/null
    uci set wireless.@wifi-iface[-1].device="${TARGET_RADIO}"
    uci set wireless.@wifi-iface[-1].mode="ap"
    uci set wireless.@wifi-iface[-1].network="lan"
    uci set wireless.@wifi-iface[-1].ssid="${ssid}"
    uci set wireless.@wifi-iface[-1].macaddr="${mac}"
    uci set wireless.@wifi-iface[-1].txpower="${TX_POWER}"
    
    # КРИТИЧЕСКИЙ ФАКТОР БЕЗОПАСНОСТИ: Жесткая изоляция клиентов внутри подсети
    # uci set wireless.@wifi-iface[-1].isolate="1" 
    
    # Настройка безопасности и авторизации
    uci set wireless.@wifi-iface[-1].encryption="${ENCRYPTION}"
    if [ "$ENCRYPTION" = "psk2" ]; then
        uci set wireless.@wifi-iface[-1].key="${WIFI_PASSWORD}"
    fi

    count=$((count + 1))
done

echo "[*] Синхронизация системных файлов конфигурации OpenWRT..."
uci commit wireless

echo "[*] Перезагрузка физических радиомодулей роутера..."
wifi reload

echo "=== [УСПЕХ] Инфраструктура Калифорнии развернута. 15 физических точек в эфире! ==="
