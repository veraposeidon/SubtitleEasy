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

let dual_subs_enabled = false;
let menu_option = null;
let dual_subtitle_track = null;

// 发送消息给 background 的渠道
const port = chrome.runtime.connect();
port.postMessage({ message: 'Nothing' });

// 自动读取用户设置，用于主动触发 双字幕功能
chrome.storage.sync.get('enabled', ({ enabled }) => {
  dual_subs_enabled = enabled;
});

// 被动触发 双字幕功能. by 监听来自 popup 的消息，
chrome.runtime.onMessage.addListener(({ enabled: isEnabled }) => {
  dual_subs_enabled = isEnabled;
});

// 主动触发 双字幕功能，by 监听页面加载完毕事件
window.onload = async () => {
  console.log('window.onload');
  // 因为页面加载和视频加载等异步问题，包括字幕开关被覆盖等问题，逐个解决问题比较麻烦
  // 开一个全局定时器来解决
  setInterval(() => {
    updateSubtitles();
  }, 500);
};

async function updateSubtitles() {
  if (!dual_subs_enabled) {
    display_menu_option(false, menu_option);
    hide_subtitle(dual_subtitle_track);
    return;
  } else {
    display_menu_option(true, menu_option);
    show_subtitle(dual_subtitle_track);
  }

  const videoElement = document.querySelector('video');
  if (!videoElement) {
    return;
  }
  const source_lang = 'en';
  const source_subtitle = get_subtitle_by_lang(videoElement, source_lang);

  const target_lang = 'zh-CN';
  const target_subtitle = get_subtitle_by_lang(videoElement, target_lang);

  const dual_lang = source_lang + '.' + target_lang;
  dual_subtitle_track = get_subtitle_by_lang(videoElement, dual_lang);

  if (source_subtitle && target_subtitle) {
    if (!dual_subtitle_track) {
      dual_subtitle_track = clone_track_to_video(
        videoElement,
        source_subtitle,
        'Dual Subtitle',
        dual_lang
      );
      menu_option = await append_option_to_menu();
    }
  } else if (target_subtitle && !source_subtitle) {
    if (!dual_subtitle_track) {
      dual_subtitle_track = clone_track_to_video(
        videoElement,
        target_subtitle,
        'Dual Subtitle',
        dual_lang
      );
      menu_option = await append_option_to_menu();
    }
  } else if (source_subtitle && !target_subtitle) {
    if (!dual_subtitle_track) {
      dual_subtitle_track = clone_track_to_video(
        videoElement,
        source_subtitle,
        'Dual Subtitle',
        dual_lang
      );
      await sleep(1000);
      set_translated_subtitle(dual_subtitle_track, source_lang, target_lang);
      menu_option = await append_option_to_menu();
    }
  }
}

function hide_subtitle(track) {
  // 调整为 hidden 是为了让字幕不显示在视频上，但是仍然可以通过 track.cues 来获取字幕内容
  if (track && track.mode !== 'hidden') {
    track.mode = 'hidden';
  }
}

function show_subtitle(track) {
  if (track && track.mode !== 'showing') {
    track.mode = 'showing';
  }
}

function clone_track_to_video(videoElement, baseTrack, label, srclang) {
  const clonedTrack = document.createElement('track');
  clonedTrack.kind = baseTrack.kind;
  clonedTrack.label = label;
  clonedTrack.srclang = srclang;
  clonedTrack.track.mode = 'showing';
  // filter the same srclang with base track
  const trackNodes = document.querySelectorAll('track');
  for (const node of trackNodes) {
    if (node.srclang === baseTrack.language) {
      clonedTrack.src = node.src;
      break;
    }
  }
  videoElement.appendChild(clonedTrack);
  return clonedTrack;
}

async function append_option_to_menu() {
  await sleep(1000);
  const subtitleMenu_ul = document.getElementById('subtitle-menu');
  const clonedLi = subtitleMenu_ul.children[0].cloneNode(true);
  subtitleMenu_ul.insertBefore(clonedLi, subtitleMenu_ul.children[0]);
  return clonedLi;
}

function display_menu_option(enabled, li_ele) {
  if (!li_ele) {
    return;
  }
  li_ele.children[0].children[1].setAttribute(
    'aria-label',
    `Dual(${enabled ? 'enabled' : 'disabled'})`
  );
  li_ele.children[0].children[1].textContent = `Dual(${
    enabled ? 'enabled' : 'disabled'
  })`;
}

function get_subtitle_by_lang(videoElement, language) {
  // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/track
  const textTracks = videoElement.textTracks;

  if (!textTracks || textTracks.length === 0) {
    return null;
  }

  for (const track of textTracks) {
    if (track.language === language) {
      return track;
    }
  }

  return null;
}

function set_translated_subtitle(track, source_lang, target_lang) {
  let cues = track.cues;
  // 由于逐句翻译会大量请求翻译 API，需要减少请求次数
  const cuesTextList = getCuesTextList(cues);
  // 逐个翻译，并替换原来的字幕
  for (const element of cuesTextList) {
    getTranslation(element[1], source_lang, target_lang, (translatedText) => {
      // 用两个换行符来分割，因为有的视频字幕是自带换行符
      const translatedTextList = translatedText.split('\n\n');
      for (let j = 0; j < translatedTextList.length; j++) {
        cues[element[0] + j].text += '\n' + translatedTextList[j];
      }
    });
  }
}

function getCuesTextList(cues) {
  // 取出字幕的所有文本内容，整合成为一个列表
  // 每项为不大于 5000 字的字符串，（好像目前使用的这个 API 有 5000 字上限？）
  // 以及它在 cues 的起始位置
  // 返回的数据结构大概是 [[0, 文本], [95, 文本]]
  let cuesTextList = [];
  for (let i = 0; i < cues.length; i++) {
    if (
      cuesTextList.length &&
      cuesTextList[cuesTextList.length - 1][1].length + cues[i].text.length <
        4500
    ) {
      // 需要插入一个分隔符(换行)，以便之后为翻译完的字符串 split
      // 用两个换行符来分割，因为有的视频字幕是自带换行符
      cuesTextList[cuesTextList.length - 1][1] += '\n\n' + cues[i].text;
    } else {
      cuesTextList.push([i, cues[i].text]);
    }
  }
  return cuesTextList;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTranslation(words, source_lang, target_lang, callback) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source_lang}&tl=${target_lang}&dt=t&q=${encodeURI(
    words
  )}`;
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const translatedList = data[0];
      let translatedText = '';
      for (const element of translatedList) {
        translatedText += element[0];
      }
      callback(translatedText);
    })
    .catch((error) => console.error(error));
}
