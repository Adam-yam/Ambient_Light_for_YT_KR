import { validateBackup } from './libs/backup';
import { presets } from './libs/presets';
import { storage } from './libs/storage';
import SettingsConfig from './libs/settings-config';
import { on } from './libs/generic';
const importExportStatus = document.querySelector('#importExportStatus');
const importExportStatusDetails = document.querySelector('#importExportStatusDetails');
const importSettings = async (storageName, importJson) => {
  try {
    importExportStatus.textContent = '';
    importExportStatus.classList.remove('has-error');
    importExportStatusDetails.textContent = '';
    importExportStatusDetails.scrollTo(0, 0);
    const jsonString = await importJson();
    if (!jsonString) throw new Error('가져올 설정을 찾을 수 없습니다');
    const {
      settings,
      warnings: importWarnings
    } = validateBackup(JSON.parse(jsonString), SettingsConfig);
    await storage.set(settings, undefined, true);
    await updatePresetSelection();
    importExportStatus.textContent = `가져온 설정: ${Object.keys(settings).length}개 (${storageName})
(열려 있는 유튜브 탭을 새로고침하면 적용됩니다.)${importWarnings.length ? `\n\n경고 ${importWarnings.length}개:\n- ${importWarnings.join('\n- ')}` : ''}`;
    if (importWarnings.length) {
      importExportStatus.classList.add('has-error');
    }
    importExportStatusDetails.textContent = `가져온 설정 보기 (클릭)\n참고: blur 설정은 내부적으로 blur2로 변환됩니다\n\n${Object.keys(settings).map(key => `${key.substring('setting-'.length)}: ${JSON.stringify(settings[key])}`).join('\n')}`;
  } catch (ex) {
    console.error('Failed to import settings', ex);
    importExportStatus.classList.add('has-error');
    importExportStatus.textContent = `설정을 가져오지 못했습니다: \n${ex?.message}`;
  }
};
const exportSettings = async (storageName, exportJson) => {
  try {
    importExportStatus.textContent = '';
    importExportStatus.classList.remove('has-error');
    importExportStatusDetails.textContent = '';
    importExportStatusDetails.scrollTo(0, 0);
    const storageData = (await storage.get(null, true)) || {};
    let exportObject = Object.fromEntries(SettingsConfig.map(setting => [setting.name, storageData[`setting-${setting.name}`] ?? setting.default]));
    if ('blur2' in exportObject) {
      exportObject.blur = exportObject.blur2;
      delete exportObject.blur2;
    }
    exportObject = Object.keys(exportObject).sort().reduce((obj, key) => (obj[key] = exportObject[key], obj), {});
    const jsonString = JSON.stringify(exportObject, null, 2);
    await exportJson(jsonString);
    importExportStatus.textContent = `내보낸 설정: ${Object.keys(exportObject).length}개 ${storageName}`;
    importExportStatusDetails.textContent = `내보낸 설정 보기 (클릭)\n\n${Object.keys(exportObject).map(key => `${key}: ${JSON.stringify(exportObject[key])}`).join('\n')}`;
  } catch (ex) {
    console.error('Failed to export settings', ex);
    importExportStatus.classList.add('has-error');
    importExportStatus.textContent = `설정을 내보내지 못했습니다: \n${ex?.message}`;
  }
};
const importFileButton = document.querySelector('#importFileBtn');
const importFileInput = document.querySelector('[name="import-settings-file"]');
on(importFileInput, 'change', async () => {
  if (!importFileInput.files.length) return;
  if (importFileInput.files[0].size > 1024 * 1024) {
    importExportStatus.textContent = '설정 파일은 1MB 이하여야 합니다.';
    importFileInput.value = '';
    return;
  }
  await importSettings('파일', async () => {
    return await new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        on(reader, 'load', e => resolve(e.target.result));
        reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
        reader.onabort = () => reject(new Error('파일 읽기가 취소되었습니다.'));
        reader.readAsText(importFileInput.files[0]);
      } catch (ex) {
        reject(ex);
      }
      importFileInput.value = '';
    });
  });
});
on(importFileButton, 'click', () => importFileInput.click());
let exportedSettingsLink;
let exportUrl;
on(window, 'pagehide', () => {
  if (exportUrl) URL.revokeObjectURL(exportUrl);
});
const exportFileButton = document.querySelector('#exportFileBtn');
on(exportFileButton, 'click', async () => {
  await exportSettings('', jsonString => {
    const blob = new Blob([jsonString], {
      type: 'application/json'
    });
    const link = exportedSettingsLink = exportedSettingsLink ?? document.createElement('a');
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    link.setAttribute('href', exportUrl);
    link.setAttribute('download', 'ambient-light-for-youtube-settings.json');
    link.setAttribute('title', '자동 다운로드가 차단되면:\n1. 이 링크를 우클릭하세요.\n2. “다른 이름으로 링크 저장”을 선택하세요.');
    link.style.display = 'block';
    link.style.marginTop = '0';
    link.style.marginBottom = '4px';
    link.textContent = 'ambient-light-for-youtube-settings.json';
    importExportStatusDetails.parentElement.insertBefore(link, importExportStatusDetails);
    link.click();
  });
});
const presetButtons = document.querySelectorAll('[data-preset]');
const presetStatus = document.querySelector('#presetStatus');
let applyingPreset = false;
async function updatePresetSelection() {
  const saved = (await storage.get(null)) || {};
  for (const button of presetButtons) {
    const preset = presets.find(item => item.id === button.dataset.preset);
    const selected = Object.entries(preset.values).every(([name, value]) => {
      const setting = SettingsConfig.find(item => item.name === name);
      return (saved[`setting-${name}`] ?? setting?.default) === value;
    });
    button.setAttribute('aria-pressed', String(selected));
  }
}
for (const button of presetButtons) {
  on(button, 'click', async () => {
    if (applyingPreset) return;
    applyingPreset = true;
    for (const item of presetButtons) item.disabled = true;
    const preset = presets.find(item => item.id === button.dataset.preset);
    presetStatus.textContent = '설정을 저장하고 있습니다…';
    try {
      const entries = Object.fromEntries(Object.entries(preset.values).map(([name, value]) => [`setting-${name}`, value]));
      entries['ambientlight-preset-request'] = {
        id: preset.id,
        token: crypto.randomUUID()
      };
      await storage.set(entries, undefined, true);
      await updatePresetSelection();
      presetStatus.textContent = `${preset.label} 적용 완료. 열려 있는 유튜브의 조명에 바로 반영됩니다.`;
    } catch (error) {
      presetStatus.textContent = `저장하지 못했습니다. ${error.message || '다시 시도하세요.'}`;
    } finally {
      applyingPreset = false;
      for (const item of presetButtons) item.disabled = false;
    }
  });
}
updatePresetSelection().catch(() => {
  presetStatus.textContent = '설정을 읽지 못했습니다. 창을 다시 열어 주세요.';
});
storage.addListener(() => {
  updatePresetSelection().catch(() => {});
});
