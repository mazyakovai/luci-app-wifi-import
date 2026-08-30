'use strict';
import { ui } from 'luci';
import { view } from 'luci';
import { fs } from 'luci';

return view.extend({
	handleUpload: function(ev) {
		var fileInput = document.getElementById('csv_file');
		if (!fileInput.files.length) {
			ui.addNotification(null, E('p', 'Ошибка: Выберите CSV файл перед загрузкой!'), 'danger');
			return;
		}

		var file = fileInput.files;
		var reader = new FileReader();

		ui.showModal(L.sidebar ? 'Загрузка...' : null, E('p', { 'class': 'spinning' }, 'Обработка и применение конфигурации сетей...'));

		reader.onload = function(e) {
			// 1. Загружаем содержимое файла в /tmp/wifi_vendor.csv
			fs.write('/tmp/wifi_vendor.csv', e.target.result)
				.then(function() {
					// 2. Запускаем ваш системный bash-скрипт в /root/update_wifi.sh
					return fs.exec('/bin/sh', ['/root/update_wifi.sh']);
				})
				.then(function(res) {
					ui.hideModal();
					// 3. Выводим лог работы bash-скрипта пользователю
					var output = (res.stdout || '') + (res.stderr || '');
					ui.showModal('Результат импорта сетей', [
						E('pre', { 'style': 'background:#222; color:#fff; padding:15px; border-radius:4px; max-height:400px; overflow-y:auto;' }, output),
						E('div', { 'class': 'right' }, [
							E('button', { 'class': 'btn cbi-button-action', 'click': ui.hideModal }, 'Закрыть')
						])
					]);
				})
				.catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, E('p', 'Системная ошибка: ' + err.message), 'danger');
				});
		};

		reader.readAsText(file);
	},

	render: function() {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'Импорт конфигурации Wi-Fi сетей'),
			E('div', { 'class': 'cbi-map-descr' }, 'Загрузите CSV-файл со списком MAC-адресов и SSID для автоматического развертывания рабочих точек доступа.'),
			
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, 'Выберите файл конфигурации (.csv):'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 'type': 'file', 'id': 'csv_file', 'accept': '.csv' })
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }),
						E('div', { 'class': 'cbi-value-field' }, [
							E('button', {
								'class': 'btn cbi-button-save-apply',
								'click': this.handleUpload.bind(this)
							}, 'Загрузить и применить')
						])
					])
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
