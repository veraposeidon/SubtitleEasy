// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const toggleSwitch = document.getElementById('toggle-switch');

// 读取用户设置，更新 UI
chrome.storage.sync.get('enabled', ({ enabled }) => {
  toggleSwitch.checked = enabled;
  // 更新 UI
  updatePopupStatus(enabled);
});

// 监听开关切换事件，更新用户设置
toggleSwitch.addEventListener('change', async ({ target }) => {
  // 更新 UI
  updatePopupStatus(target.checked);
  // 保存用户设置
  chrome.storage.sync.set({ enabled: target.checked }).then(() => {});
  // 通知 content 更新字幕
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // 拦截非声明页面的请求
  if (!tab.url) {
    return;
  }
  // 发消息
  await chrome.tabs.sendMessage(tab.id, {
    enabled: target.checked
  });
});

// 配置下拉框数据
document.addEventListener('DOMContentLoaded', async () => {
  const select = document.getElementById('language-select');
  const options = await getSupportLanguages();
  // Load localized strings
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const message = chrome.i18n.getMessage(elem.getAttribute('data-i18n'));
    if (message) {
      elem.innerText = message;
    }
  });
  console.log('options', options);
  Object.keys(options).forEach((key) => {
    const optionElement = document.createElement('option');
    optionElement.value = key;
    optionElement.innerText = options[key];
    select.appendChild(optionElement);
  });

  // 读取用户设置，更新下拉框默认值
  chrome.storage.sync.get('target_language', ({ target_language }) => {
    if (!target_language) {
      const locale = chrome.i18n.getUILanguage();
      target_language = locale;
    }
    select.value = target_language;
  });

  // 监听下拉框切换事件，更新用户设置
  select.addEventListener('change', async ({ target }) => {
    // 保存用户设置
    chrome.storage.sync.set({ target_language: target.value }).then(() => {});
    // 通知 content 更新字幕
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    // 拦截非声明页面的请求
    if (!tab.url) {
      return;
    }
    // toast 提示
    showToast('设置生效，刷新网页');
    // reload tab
    await chrome.tabs.reload(tab.id);
  });
});

function updatePopupStatus(enabled) {
  // chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' }).then(() => {});
  // green and gray
  chrome.action.setBadgeBackgroundColor({
    color: enabled ? '#00ff00' : '#808080'
  });
  // disable select if enabled is false
  const select = document.getElementById('language-select');
  select.disabled = !enabled;
}

async function getSupportLanguages() {
  const recent_locale = (await chrome.storage.sync.get('recent_locale'))
    .recent_locale;
  const current_locale = chrome.i18n.getUILanguage();
  await chrome.storage.sync.set({
    recent_locale: current_locale
  });
  const locale_same = recent_locale === current_locale;
  const support_languages = (await chrome.storage.sync.get('support_languages'))
    .support_languages;
  if (support_languages || locale_same) {
    return support_languages;
  } else {
    return getGoogleTranslateApiSupportedLanguages(current_locale);
  }
}

/// 获取谷歌翻译支持的语言，保存到本地供 pop 页面使用
/// 返回值为一个 map, key 为语言代码，value 为语言名称
async function getGoogleTranslateApiSupportedLanguages(locale) {
  const url = `https://translate.googleapis.com/translate_a/l?client=webapp&hl=${locale}`;
  // Access to fetch at 'https://translate.googleapis.com/translate_a/l?client=webapp&hl=zh-CN' from origin 'chrome-extension://gdignmkpgdklaldmdgaonahopedjbkei' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.
  const response = await fetch(url, {
    mode: 'cors'
  });
  const data = await response.json();
  const support_languages = data['tl'];
  // 保存到本地
  chrome.storage.sync
    .set({ support_languages: support_languages })
    .then(() => {});

  return support_languages;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.classList.add('show');

  setTimeout(function () {
    toast.classList.remove('show');
  }, 2000);
}
