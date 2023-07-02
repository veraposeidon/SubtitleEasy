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
let target_subs_has_set = false;
let last_cues_length = 0; // 用于记录上一次字幕长度，用于判断是否有新字幕更新或者切换字幕
let origin_text_track = null;
let origin_cue_ids = [];
const base_sub_lang = 'en';
let target_sub_lang = '';

// 自动读取用户设置，用于主动触发 双字幕功能
chrome.storage.sync.get('enabled', ({ enabled }) => {
  dual_subs_enabled = enabled;
});

chrome.storage.sync.get('target_language', ({ target_language }) => {
  target_sub_lang = target_language;
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
  }, 1000);
};

// WWDC 有目标语言字幕，则直接展示目标语言字幕
// WWDC 没有目标语言字幕，则展示原字幕，并翻译成目标语言，拼接附着在原字幕上
async function updateSubtitles() {
  // 如果没有开启双字幕功能，则不执行
  if (!dual_subs_enabled) return;
  // 如果已经设置过目标语言字幕，则不再执行（因为有目标语言字幕，且设置过一次，后面跟随用户操作即可）
  if (target_subs_has_set) return;

  const htmlVideoElement = document.querySelector('video');
  if (!htmlVideoElement) {
    console.log('htmlVideoElement not found');
    return;
  }

  // 有目标语言字幕，则直接展示目标语言字幕
  let matched_target_sub_lang = target_sub_lang;
  let target_text_track = get_text_track_by_lang(
    htmlVideoElement,
    matched_target_sub_lang
  );
  if (!target_text_track) {
    // 处理中文简体和繁体的问题，Apple Developer 视频只有简体，没有繁体
    // 当 WWDC 有简体zh时，目标语言为 zh-CN zh-TW 时，都展示 zh
    // 当 WWDC 没有简体zh时，按照目标语言分别翻译为 zh-CN 或 zh-TW
    matched_target_sub_lang = matched_target_sub_lang.split('-')[0];
    target_text_track = get_text_track_by_lang(
      htmlVideoElement,
      matched_target_sub_lang
    );
  }

  if (target_text_track) {
    console.log(`target_text_track find and set to ${matched_target_sub_lang}`);
    highlight_text_track_by_lang(htmlVideoElement, matched_target_sub_lang);
    target_subs_has_set = true;
    return;
  }

  // 没有目标语言字幕，则展示原字幕，并翻译成目标语言，拼接附着在原字幕上
  const base_text_track = get_text_track_by_lang(
    htmlVideoElement,
    base_sub_lang
  );

  if (!base_text_track || !base_text_track.cues) {
    console.log('base_text_track not found');
    return;
  }

  const cues = base_text_track.cues;
  if (cues.length === last_cues_length || cues.length === 0) {
    return;
  }

  if (!origin_text_track) {
    // create a text track
    // 用于存放原文用的 track
    origin_text_track = htmlVideoElement.addTextTrack(
      'subtitles',
      '🚫 Backup',
      base_sub_lang
    );
    hide_text_track(origin_text_track);
  }

  // 遍历新增的 cue，如果已经翻译过，则不再添入，因为会重复翻译
  for (const cue of cues) {
    if (origin_cue_ids.includes(cue.id)) {
      continue;
    }

    const origin_cue = new VTTCue(cue.startTime, cue.endTime, cue.text);
    origin_cue.id = cue.id;
    origin_text_track.addCue(origin_cue);
    origin_cue_ids.push(cue.id);
  }

  // 每次都从头翻译
  set_translated_subtitle(
    base_text_track,
    origin_text_track,
    base_sub_lang,
    target_sub_lang
  );

  // 将翻译后的
  last_cues_length = cues.length;
}

function hide_text_track(track) {
  if (track && track.mode !== 'hidden') {
    track.mode = 'hidden';
  }
}

function disable_text_track(track) {
  if (track && track.mode !== 'disabled') {
    track.mode = 'disabled';
  }
}

function show_text_track(track) {
  if (track && track.mode !== 'showing') {
    track.mode = 'showing';
  }
}

function get_text_track_by_lang(videoElement, language) {
  // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/track
  const textTracks = videoElement.textTracks;
  console.log('language', language);

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

function highlight_text_track_by_lang(videoElement, language) {
  const textTracks = videoElement.textTracks;

  if (!textTracks || textTracks.length === 0) {
    return;
  }

  for (const track of textTracks) {
    if (track.language === language) {
      show_text_track(track);
    } else {
      disable_text_track(track);
    }
  }
}

function set_translated_subtitle(
  target_track,
  text_track,
  source_lang,
  target_lang
) {
  const text_cues = Array.from(text_track.cues);
  const target_cues = Array.from(target_track.cues);

  let startIndex = text_cues.findIndex((cue) => {
    return cue.translated !== true;
  });
  let endIndex = text_cues.findLastIndex((cue) => {
    return cue.translated !== true;
  });
  startIndex = Math.max(startIndex - 10, 0);
  endIndex = Math.min(endIndex + 10, text_cues.length - 1);

  const need_translated_text_cues = text_cues.slice(startIndex, endIndex + 1);

  const need_translated_target_cues = target_cues.slice(
    startIndex,
    endIndex + 1
  );

  // 由于逐句翻译会大量请求翻译 API，需要减少请求次数
  const cuesTextList = getCuesTextList(need_translated_text_cues);
  // 逐个翻译，并替换原来的字幕
  for (const element of cuesTextList) {
    getTranslation(element[1], source_lang, target_lang, (translatedText) => {
      // 用两个换行符来分割，因为有的视频字幕是自带换行符
      const translatedTextList = translatedText.split('\n\n');
      for (let j = 0; j < translatedTextList.length; j++) {
        need_translated_target_cues[element[0] + j].text =
          // 原文 + 换行 + 译文
          need_translated_text_cues[element[0] + j].text +
          '\n' +
          translatedTextList[j];
        need_translated_text_cues[element[0] + j].translated = true; // 标记已翻译
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
      // 移除字幕中的换行，因为影响翻译效果，效果增强很多
      cuesTextList[cuesTextList.length - 1][1] +=
        '\n\n' + cues[i].text.replace('\n', '');
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
