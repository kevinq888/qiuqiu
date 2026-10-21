(() => {
  const api = window.qiuqiuUpdater;
  if (!api) return;
  let state = { status: 'idle' };
  const busy = new Set(['downloading', 'preparing', 'restarting']);
  function render() {
    const actions = document.querySelector('.header-actions');
    if (!actions) return;
    let button = document.getElementById('desktop-update');
    if (!button) {
      button = document.createElement('button');
      button.id = 'desktop-update';
      button.type = 'button';
      button.className = 'desktop-update-button';
      button.addEventListener('click', () => {
        if (busy.has(state.status)) return;
        // Set the busy state synchronously to reject double clicks in the same frame.
        state = { ...state, status: 'downloading', progress: 0 };
        render();
        api.install().then(next => { state = next; render(); }).catch(() => {
          state = { ...state, status: 'error', error: '更新暂时不可用，请重试' }; render();
        });
      });
      actions.insertBefore(button, actions.querySelector('.theme-picker'));
    }
    button.hidden = !['available', 'error', ...busy].includes(state.status);
    button.disabled = busy.has(state.status);
    button.dataset.status = state.status;
    button.setAttribute('aria-busy', String(busy.has(state.status)));
    const labels = {
      available: `更新 v${state.version}`, downloading: `下载 ${state.progress || 0}%`,
      preparing: '准备更新…', restarting: '正在重启…', error: '更新重试',
    };
    button.textContent = labels[state.status] || '';
    button.title = state.status === 'error' ? state.error : `当前 v${state.currentVersion}，更新后自动重启并保留播放进度`;
    button.setAttribute('aria-label', button.textContent);
  }
  window.qiuqiuUpdateUI = { refresh: render };
  api.onState(next => { state = next; render(); });
  api.state().then(next => { state = next; render(); }).catch(() => {});
})();
