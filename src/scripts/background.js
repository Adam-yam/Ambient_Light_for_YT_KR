import { getBrowser } from './libs/utils';
if (chrome.runtime.setUninstallURL) chrome.runtime.setUninstallURL('');
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason !== 'install' && details.reason !== 'update') return;
  if (chrome.runtime.setUninstallURL) {
    chrome.runtime.setUninstallURL('');
  }
  if (details.reason === 'install' && getBrowser() === 'Firefox') {
    chrome.runtime.openOptionsPage();
  }
});
chrome.action.onClicked.addListener(function () {
  chrome.runtime.openOptionsPage();
});
