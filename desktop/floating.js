const widget = document.querySelector('.widget');
const record = document.querySelector('.record');
const close = document.querySelector('.close');
const track = document.querySelector('.track');
const trackText = document.querySelector('.track-text');
const progressRing = document.querySelector('.ring-progress');
const ringLength = 2 * Math.PI * 42;
let pointerStart = null;
let dragMoved = false;
let suppressClick = false;
let resizeBackTimer;
let currentTitle = '';
progressRing.style.strokeDasharray = `${ringLength} ${ringLength}`;
progressRing.style.strokeDashoffset = String(ringLength);

function fitTrackTitle() {
  const textWidth = trackText.scrollWidth;
  const windowWidth = Math.max(92, Math.min(360, Math.ceil(textWidth + 32)));
  const visibleTextWidth = Math.max(1, windowWidth - 42);
  const distance = Math.max(0, textWidth - visibleTextWidth);
  track.classList.toggle('is-marquee', distance > 4);
  track.style.setProperty('--scroll-distance', `${distance}px`);
  track.style.setProperty('--marquee-duration', `${Math.max(6, distance / 20)}s`);
  window.qiuqiuDesktop.resizeTrack(windowWidth);
}

widget.addEventListener('pointerenter', () => {
  clearTimeout(resizeBackTimer);
  widget.classList.add('is-hovered');
  fitTrackTitle();
});
widget.addEventListener('pointerleave', () => {
  widget.classList.remove('is-hovered');
  resizeBackTimer = setTimeout(() => window.qiuqiuDesktop.resizeTrack(92), 220);
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
window.qiuqiuDesktop.onPlaybackState(state => {
  widget.classList.toggle('is-playing', !!state.playing);
  const hasTrack = !!state.hasTrack && !!state.title;
  const title = hasTrack ? state.title : '秋秋音乐';
  if (title !== currentTitle) {
    currentTitle = title;
    trackText.textContent = title;
    track.title = title;
    if (widget.classList.contains('is-hovered')) fitTrackTitle();
  }
  const duration = Number(state.duration) || 0;
  const currentTime = Number(state.currentTime) || 0;
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  progressRing.style.strokeDashoffset = String(ringLength * (1 - progress));
});
