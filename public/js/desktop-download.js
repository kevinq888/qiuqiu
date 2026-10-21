(() => {
  const releases = 'https://github.com/kevinq888/qiuqiumusic/releases/latest';
  let platform = '';
  let architecture = '';
  let refreshId = 0;
  function close() {
    const choices = document.getElementById('desktop-download-choices');
    if (choices) choices.hidden = true;
    document.getElementById('desktop-download')?.setAttribute('aria-expanded', 'false');
  }
  async function refresh() {
    const id = ++refreshId;
    const button = document.getElementById('desktop-download');
    if (!button) return;
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const os = navigator.userAgentData?.platform || navigator.platform || ua;
    platform = /Win/i.test(os) ? 'windows' : /Mac/i.test(os) ? 'macos' : '';
    button.hidden = mobile || /Electron\//.test(ua) || !platform;
    button.closest('.desktop-download-wrap').hidden = button.hidden;
    if (button.hidden) return;
    architecture = '';
    button.href = platform === 'windows' ? '/download/desktop/windows-x64' : releases;
    button.title = platform === 'windows' ? '下载最新版 Windows 桌面版（ZIP，解压后安装）' : '下载最新版 macOS 桌面版';
    button.setAttribute('aria-expanded', 'false');
    if (platform === 'macos' && navigator.userAgentData?.getHighEntropyValues) {
      try {
        const info = await navigator.userAgentData.getHighEntropyValues(['architecture']);
        if (id !== refreshId) return;
        architecture = /arm/i.test(info.architecture) ? 'arm64' : /x86/i.test(info.architecture) ? 'x64' : '';
        if (architecture) button.href = `/download/desktop/macos-${architecture}`;
      } catch { /* Safari and other browsers may not disclose the chip: offer both Mac packages. */ }
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('#desktop-download');
    if (button && platform === 'macos' && !architecture && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
      event.preventDefault();
      const choices = document.getElementById('desktop-download-choices');
      choices.hidden = !choices.hidden;
      button.setAttribute('aria-expanded', String(!choices.hidden));
    } else if (!event.target.closest('.desktop-download-wrap') || event.target.closest('[data-desktop-package]')) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); } });
  window.qiuqiuDownloads = { refresh };
  refresh();
})();
