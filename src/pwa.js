(function () {
  const version = window.__APP_VERSION__ || '20260726-fully-offline';
  const localMathJaxUrl = new URL('./vendor/mathjax/tex-svg.js', document.baseURI).href;
  const legacyMathJaxPattern = /https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@3(?:[^/]*)\/es5\/tex-svg(?:-full)?\.js/g;
  let deferredInstallPrompt = null;

  function showVersion() {
    // 顶部副标题按用户要求保持隐藏；版本号仅用于资源更新与离线缓存。
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function patchHtmlBlobMathJax() {
    const NativeBlob = window.Blob;
    if (!NativeBlob || NativeBlob.__11408OfflinePatched) return;

    function OfflineBlob(parts, options) {
      const type = String(options?.type || '').toLowerCase();
      const nextParts = type.includes('text/html')
        ? Array.from(parts || [], (part) => typeof part === 'string'
          ? part.replace(legacyMathJaxPattern, localMathJaxUrl)
          : part)
        : parts;
      return new NativeBlob(nextParts, options);
    }

    OfflineBlob.prototype = NativeBlob.prototype;
    Object.setPrototypeOf(OfflineBlob, NativeBlob);
    OfflineBlob.__11408OfflinePatched = true;
    window.Blob = OfflineBlob;
  }

  function setupInstallButton() {
    const button = document.getElementById('installAppBtn');
    if (!button) return;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      button.hidden = false;
    });

    button.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        notify('浏览器菜单中选择“安装应用”或“添加到主屏幕”');
        return;
      }
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      button.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      button.hidden = true;
      notify('离线版已安装，可以断网打开');
    });
  }

  function requestOfflineStatus(registration) {
    const worker = registration.active || registration.waiting || registration.installing;
    worker?.postMessage({ type: 'CHECK_OFFLINE_READY' });
  }

  showVersion();
  patchHtmlBlobMathJax();
  setupInstallButton();
  window.addEventListener('DOMContentLoaded', showVersion);

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'OFFLINE_READY' || !event.data.ready) return;
    const readyKey = `11408-offline-ready-${event.data.version || version}`;
    if (localStorage.getItem(readyKey)) return;
    localStorage.setItem(readyKey, '1');
    notify('离线资源已缓存完成，断网也能使用');
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${version}`, {
        updateViaCache: 'none'
      });

      registration.update().catch(() => {});

      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            if (navigator.serviceWorker.controller) worker.postMessage({ type: 'SKIP_WAITING' });
            requestOfflineStatus(registration);
          }
        });
      });

      const readyRegistration = await navigator.serviceWorker.ready;
      requestOfflineStatus(readyRegistration);
    } catch (error) {
      console.warn('Service Worker 注册失败：', error);
    }
  });
})();
