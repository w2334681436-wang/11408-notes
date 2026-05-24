(function () {
  const version = window.__APP_VERSION__ || String(Date.now());

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

      // 每次打开都主动检查更新，避免旧 service worker 长期缓存旧文件。
      registration.update().catch(() => {});

      // 新 SW 接管后自动刷新一次，让用户看到最新代码。
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // 如果已经有 waiting worker，立刻激活。
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
