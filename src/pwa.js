(function () {
  const version = window.__APP_VERSION__ || '20260530-1120-focuspreview-nav';

  function showVersion() {
    const el = document.getElementById('appVersionText') || document.querySelector('.brand-sub');
    if (el && !el.dataset.versionInjected) {
      el.dataset.versionInjected = '1';
      el.textContent = `${el.textContent} · v${version}`;
    }
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
