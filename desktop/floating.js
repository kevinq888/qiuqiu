const widget = document.querySelector('.widget');
const record = document.querySelector('.record');
const close = document.querySelector('.close');
const panel = document.querySelector('.hover-panel');
const track = document.querySelector('.track');
const trackText = document.querySelector('.track-text');
const controls = [...document.querySelectorAll('[data-command]')];
const playControl = document.querySelector('.play-control');
const progressRing = document.querySelector('.ring-progress');
const ringLength = 2 * Math.PI * 42;
let pointerStart = null;
let dragMoved = false;
let suppressClick = false;
let hideTimer;
let currentTitle = '';
let ignoresMouse = true;
progressRing.style.strokeDasharray = `${ringLength} ${ringLength}`;
progressRing.style.strokeDashoffset = String(ringLength);
controls.forEach(button => { button.disabled = true; });

function fitTrackTitle() {
  const style = getComputedStyle(track);
  const visibleWidth = track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const distance = Math.max(0, trackText.scrollWidth - visibleWidth);
  track.classList.toggle('is-marquee', distance > 2);
  track.style.setProperty('--scroll-distance', `${distance}px`);
  track.style.setProperty('--marquee-duration', `${Math.max(7, distance / 22)}s`);
}

function expandPanel() {
  clearTimeout(hideTimer);
  hideTimer = undefined;
  if (!widget.classList.contains('is-hovered')) {
    widget.classList.add('is-hovered');
    panel.inert = false;
    fitTrackTitle();
  }
}

function scheduleHide() {
  if (hideTimer) return;
  hideTimer = setTimeout(() => {
    widget.classList.remove('is-hovered');
    panel.inert = true;
    hideTimer = undefined;
  }, 200);
}

function setMousePassthrough(ignore) {
  if (ignore === ignoresMouse) return;
  ignoresMouse = ignore;
  window.qiuqiuDesktop.ignoreMouse(ignore);
}

// The native canvas stays fixed. Only the visible disc and popup accept clicks;
// transparent space forwards input to the application underneath it.
document.addEventListener('mousemove', event => {
  const x = event.clientX, y = event.clientY;
  const overRecord = Math.hypot(x - 180, y - 46) <= 46;
  const overClose = x >= 202 && x <= 222 && y >= 4 && y <= 24;
  const panelBounds = panel.getBoundingClientRect();
  const overPanel = widget.classList.contains('is-hovered') && x >= panelBounds.left - 8 && x <= panelBounds.right + 8 && y >= 88 && y <= panelBounds.bottom + 6;
  const interactive = overRecord || overClose || overPanel || !!pointerStart;
  setMousePassthrough(!interactive);
  if (interactive) expandPanel();
  else scheduleHide();
});
document.documentElement.addEventListener('mouseleave', () => {
  if (pointerStart) return;
  setMousePassthrough(true);
  scheduleHide();
});

record.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  pointerStart = { x: event.screenX, y: event.screenY };
  dragMoved = false;
  record.setPointerCapture(event.pointerId);
  window.qiuqiuDesktop.startDrag(pointerStart);
});
record.addEventListener('pointermove', event => {
  if (!pointerStart || !event.buttons) return;
  const dx = event.screenX - pointerStart.x;
  const dy = event.screenY - pointerStart.y;
  if (!dragMoved && Math.hypot(dx, dy) < 4) return;
  dragMoved = true;
  window.qiuqiuDesktop.moveDrag({ x: event.screenX, y: event.screenY });
});
const finishDrag = () => {
  if (!pointerStart) return;
  suppressClick = dragMoved;
  pointerStart = null;
  window.qiuqiuDesktop.endDrag();
  setTimeout(() => { suppressClick = false; }, 0);
};
record.addEventListener('pointerup', finishDrag);
record.addEventListener('pointercancel', finishDrag);
record.addEventListener('click', () => {
  if (!suppressClick) window.qiuqiuDesktop.openMain();
});
close.addEventListener('click', event => {
  event.stopPropagation();
  window.qiuqiuDesktop.quit();
});
controls.forEach(button => button.addEventListener('click', () => {
  window.qiuqiuDesktop.control(button.dataset.command);
}));
window.qiuqiuDesktop.onPlaybackState(state => {
  widget.classList.toggle('is-playing', !!state.playing);
  const hasTrack = !!state.hasTrack && !!state.title;
  controls.forEach(button => { button.disabled = !hasTrack; });
  playControl.setAttribute('aria-label', state.playing ? '暂停' : '播放');
  playControl.title = state.playing ? '暂停' : '播放';
  const title = hasTrack ? state.title : '秋秋音乐';
  if (title !== currentTitle) {
    currentTitle = title;
    trackText.textContent = title;
    track.title = title;
    fitTrackTitle();
  }
  const duration = Number(state.duration) || 0;
  const currentTime = Number(state.currentTime) || 0;
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  // No track underneath: only elapsed audio is painted, including no cap at 0%.
  progressRing.style.opacity = progress > 0 ? '1' : '0';
  progressRing.style.strokeDashoffset = String(ringLength * (1 - progress));
});
