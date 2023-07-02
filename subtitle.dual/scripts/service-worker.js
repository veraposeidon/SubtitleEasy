chrome.runtime.onInstalled.addListener(function () {
  // 首次安装时、扩展程序更新到新版本时以及 Chrome 更新到新版本时都会触发该事件
  chrome.storage.sync.get('enabled', ({ enabled }) => {
    if (enabled === undefined) {
      console.log('首次安装，初始化用户设置');
      const initialValue = true;
      chrome.storage.sync.set({ enabled: initialValue }).then(() => {});
      // chrome.action
      //   .setBadgeText({ text: initialValue ? 'ON' : 'OFF' })
      //   .then(() => {});
    }
  });
});

// 监听来自 content 的消息
chrome.runtime.onConnect.addListener((port) => {
  console.log('收到来自 content 的消息');
  port.onMessage.addListener(({ message }) => {
    console.log('收到来自 content 的消息', message);
    // chrome.storage.sync.set({ enabled: enabled }).then(() => {});
    // chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' }).then(() => {});
  });
});
