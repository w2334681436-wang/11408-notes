(function () {
  const version = window.__APP_VERSION__ || '20260809-focus-zoom-v7';
  const statusEl = document.getElementById('offlineStatus');
  const installBtn = document.getElementById('installAppBtn');
  let deferredInstallPrompt = null;
  const hadServiceWorkerController = !!navigator.serviceWorker?.controller;
  let reloadingForUpdate = false;

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function setOfflineStatus(text, state) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.state = state;
    statusEl.title = state === 'ready'
      ? '页面、脚本、样式、图标和公式引擎已保存到本机'
      : text;
  }

  function queryOfflineStatus(worker) {
    return new Promise((resolve) => {
      if (!worker) {
        resolve(null);
        return;
      }
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(null), 3000);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        resolve(event.data);
      };
      worker.postMessage({ type: 'CHECK_OFFLINE_READY' }, [channel.port2]);
    });
  }

  async function refreshConnectionStatus() {
    if (!navigator.onLine) {
      setOfflineStatus('离线模式', 'offline');
      return;
    }
    const worker = navigator.serviceWorker?.controller;
    const status = await queryOfflineStatus(worker);
    setOfflineStatus(
      status?.ready ? '可离线使用' : '正在准备离线资源…',
      status?.ready ? 'ready' : 'loading'
    );
  }

  window.addEventListener('online', refreshConnectionStatus);
  window.addEventListener('offline', refreshConnectionStatus);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installBtn) installBtn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.hidden = true;
    setOfflineStatus('已安装 · 可离线', 'ready');
    notify('离线版已安装，可以断网打开');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      notify('浏览器菜单中选择“安装应用”或“添加到主屏幕”');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  if (!('serviceWorker' in navigator)) {
    setOfflineStatus('浏览器不支持离线安装', 'error');
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController || reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    setOfflineStatus('正在准备离线资源…', 'loading');
    try {
      const registration = await navigator.serviceWorker.register(`./service-worker.js?v=${version}`, {
        scope: './',
        updateViaCache: 'none'
      });

      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        setOfflineStatus('正在更新离线资源…', 'loading');
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      const readyRegistration = await navigator.serviceWorker.ready;
      const activeWorker = readyRegistration.active || navigator.serviceWorker.controller;
      const status = await queryOfflineStatus(activeWorker);
      if (status?.ready) {
        setOfflineStatus(navigator.onLine ? '可离线使用' : '离线模式', navigator.onLine ? 'ready' : 'offline');
        const readyKey = `11408-offline-ready-${status.version || version}`;
        if (!localStorage.getItem(readyKey)) {
          localStorage.setItem(readyKey, '1');
          notify('离线资源已缓存完成，断网也能使用');
        }
      } else {
        setOfflineStatus('离线资源未完整，请联网刷新', 'error');
      }

      registration.update().catch(() => {});
    } catch (error) {
      console.warn('Service Worker 注册失败：', error);
      setOfflineStatus('离线功能准备失败', 'error');
    }
  });
})();
