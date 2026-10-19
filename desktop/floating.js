const widget = document.querySelector('.widget');
const record = document.querySelector('.record');
const close = document.querySelector('.close');
const track = document.querySelector('.track');
const progressRing = document.querySelector('.ring-progress');
const ringLength = 2 * Math.PI * 42;
let pointerStart = null;
let dragMoved = false;
let suppressClick = false;
progressRing.style.strokeDasharray = `${ringLength} ${ringLength}`;
progressRing.style.strokeDashoffset = String(ringLength);

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
  track.textContent = hasTrack ? state.title : '秋秋音乐';
  track.title = hasTrack ? state.title : '秋秋音乐';
  const duration = Number(state.duration) || 0;
  const currentTime = Number(state.currentTime) || 0;
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  progressRing.style.strokeDashoffset = String(ringLength * (1 - progress));
});
