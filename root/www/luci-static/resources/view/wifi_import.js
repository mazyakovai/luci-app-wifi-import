'use strict';

/**
 * Экранирует HTML-сущности для безопасного вывода пользовательского текста в DOM.
 * Предотвращает XSS при рендере строк в outputLog и уведомлениях.
 */
function escapeHtml(str) {
	if (typeof str !== 'string') return String(str);
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

return L.view.extend({
	handleUpload: function(ev) {
		var csvDataInput = document.getElementById('csv_data');
		if (!csvDataInput || !csvDataInput.value.trim()) {
			L.ui.addNotification(null, E('p', 'Ошибка: Вставьте список MAC-адресов (MAC и SSID) в текстовое поле!'), 'danger');
			return;
		}

		var csvRaw = csvDataInput.value.trim();
		if (csvRaw.length > 50000) {
			L.ui.addNotification(null, E('p', 'Ошибка: Объём данных слишком велик (макс. 50 000 символов)!'), 'danger');
			return;
		}
		var lines = csvRaw.split(/\r?\n/);
		if (lines.length > 100) {
			L.ui.addNotification(null, E('p', 'Ошибка: Слишком много строк (макс. 100 сетей за один импорт)!'), 'danger');
			return;
		}

		ev.target.disabled = true;

		var password = document.getElementById('wifi_password').value || '88888888';
		var txPower = '20';
		var clearFlag = document.getElementById('clear_old').checked ? '1' : '0';
		var bandMode = document.getElementById('band_mode').value || 'both';
		
		var outputLog = [];
		outputLog.push("[*] Запуск импорта сетей напрямую через LuCI UCI API...");

		L.ui.showModal(L.sidebar ? 'Загрузка...' : null, E('p', { 'class': 'spinning' }, 'Применение конфигурации сетей...'));

		L.uci.load('wireless').then(function() {
			var sectionPrefix = 'imp_';
			var batchId = Date.now();
			
			if (clearFlag === '1') {
				outputLog.push("[*] Безопасная очистка только ранее импортированных сетей...");
				var sections = L.uci.sections('wireless', 'wifi-iface');
				for (var s = 0; s < sections.length; s++) {
					if (sections[s]['.name'] && sections[s]['.name'].indexOf(sectionPrefix) === 0) {
						L.uci.remove('wireless', sections[s]['.name']);
					}
				}
			}

			var count = 0;
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i].trim();
				
				if (!line || /^mac,ssid/i.test(line)) continue; 

				var chunks = line.split(',');
				if (chunks.length < 2) {
					outputLog.push("[!] Пропущена некорректная строка #" + (i + 1) + ": " + escapeHtml(line));
					continue;
				}

				var mac = chunks[0] ? chunks[0].trim().replace(/[\r\n\s]/g, '').toLowerCase() : '';
				var ssid = chunks[1] ? chunks[1].replace(/[\r\n\t]/g, '').trim() : '';
				ssid = ssid.replace(/[\"'\\;\|$\`#=&]/g, '');

				if (ssid.length > 32) {
					ssid = ssid.substring(0, 32);
				}
				if (!ssid) {
					outputLog.push("[!] Пропущена строка #" + (i + 1) + ": пустой SSID после санитайза");
					continue;
				}	

				if (!/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/.test(mac)) {
					outputLog.push("Ошибка строки #" + (i + 1) + ": Неверный формат MAC -> " + escapeHtml(mac));
					continue;
				}

				var is5G = /5G|5g|5GHz/.test(ssid);
				var targetRadio = is5G ? 'radio1' : 'radio0';
				var freqTag = is5G ? '5.0 GHz' : '2.4 GHz';

				if (bandMode === '2g' && is5G) continue;
				if (bandMode === '5g' && !is5G) continue;

				count++;
				outputLog.push("Нарезка точки #" + count + " -> [" + freqTag + "] MAC: " + escapeHtml(mac) + " | SSID: '" + escapeHtml(ssid) + "'");

				var uniqueSectionId = sectionPrefix + batchId + '_' + i + '_' + count;
				var sectionName = L.uci.add('wireless', 'wifi-iface', uniqueSectionId);
				
				L.uci.set('wireless', sectionName, 'device', targetRadio);
				L.uci.set('wireless', sectionName, 'mode', 'ap');
				L.uci.set('wireless', sectionName, 'network', 'lan');
				L.uci.set('wireless', sectionName, 'ssid', ssid);
				L.uci.set('wireless', sectionName, 'macaddr', mac);
				L.uci.set('wireless', sectionName, 'txpower', txPower);
				L.uci.set('wireless', sectionName, 'encryption', 'psk2');
				L.uci.set('wireless', sectionName, 'key', password);
			}

			if (count === 0) {
				throw new Error("Нет валидных данных для импорта. Проверьте формат строк!");
			}

			outputLog.push("[*] Синхронизация транзакций и перезапуск радиомодулей...");
			
			return L.uci.save('wireless')
				.then(function() {
					return L.uci.apply();
				})
				.then(function() {
					L.ui.hideModal();
					ev.target.disabled = false;
					outputLog.push("=== [УСПЕХ] Инфраструктура успешно развернута в беспроводном эфире! ===");
					
					csvDataInput.value = '';

					L.ui.showModal('Результат импорта', [
						E('pre', { 'style': 'background:#222; color:#fff; padding:15px; border-radius:4px; max-height:400px; overflow-y:auto;' }, outputLog.join('\n')),
						E('div', { 'class': 'right' }, [
							E('button', { 'class': 'btn cbi-button-action', 'click': L.ui.hideModal }, 'Закрыть')
						])
					]);
				});
				
		}).catch(function(err) {
			L.ui.hideModal();
			ev.target.disabled = false;
			L.ui.addNotification(null, E('p', 'Системная ошибка: ' + escapeHtml(err.message)), 'danger');
		});
	},

	render: function() {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'Импорт конфигурации Wi-Fi сетей'),
			E('div', { 'class': 'cbi-map-descr' }, 'Скопируйте и вставьте список MAC-адресов и SSID для автоматического развертывания.'),
			
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': 'wifi_password' }, 'Пароль Wi-Fi:'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 'type': 'text', 'id': 'wifi_password', 'class': 'cbi-input-text', 'value': '88888888' })
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': 'clear_old' }, 'Очистить предыдущий импорт (не затронет личные сети):'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 'type': 'checkbox', 'id': 'clear_old', 'checked': true })
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': 'band_mode' }, 'Диапазон для импорта:'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('select', { 'id': 'band_mode', 'class': 'cbi-input-select' }, [
								E('option', { 'value': 'both' }, '2.4 and 5 GHz'),
								E('option', { 'value': '2g' }, '2.4 GHz'),
								E('option', { 'value': '5g' }, '5 GHz')
							])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title', 'for': 'csv_data' }, 'Список MAC-адресов (mac,ssid):'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('textarea', { 
								'id': 'csv_data', 
								'class': 'cbi-input-textarea', 
								'rows': '10', 
								'style': 'width:100%; font-family:monospace;',
								'placeholder': '3C:8C:F8:F3:FD:8B,TP-LINK_5890\n34:85:84:53:38:27,Mercusys_8470_5G',
								'input': function(ev) {
									var btn = document.getElementById('btn_submit');
									if (btn) {
										btn.disabled = (ev.target.value.trim() === '');
									}
								}
							})
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }),
						E('div', { 'class': 'cbi-value-field' }, [
							E('button', { 
								'id': 'btn_submit',
								'class': 'btn cbi-button-save-apply', 
								'disabled': true,
								'click': this.handleUpload.bind(this) 
							}, 'Загрузить и применить')
						])
					])
				])
			])
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
