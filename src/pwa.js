(function () {
  const version = window.__APP_VERSION__ || '20260616-1930-aiexport';

  function showVersion() {
    // 顶部副标题已按用户要求隐藏；版本号只保留在 window.__APP_VERSION__ 和缓存参数中。
  }

  showVersion();
  window.addEventListener('DOMContentLoaded', showVersion);

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${version}`, {
        updateViaCache: 'none'
      });

      // 只检查更新，不再自动 controllerchange reload，避免每次打开软件随机频闪/抖动。
      registration.update().catch(() => {});

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (error) {
      console.warn('Service Worker 注册失败：', error);
    }
  });
})();
