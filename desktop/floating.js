const widget = document.querySelector('.widget');
const record = document.querySelector('.record');
const close = document.querySelector('.close');
const track = document.querySelector('.track');
const progressRing = document.querySelector('.ring-progress');
const ringLength = 2 * Math.PI * 42;
progressRing.style.strokeDasharray = `${ringLength} ${ringLength}`;
progressRing.style.strokeDashoffset = String(ringLength);

record.addEventListener('click', () => window.qiuqiuDesktop.openMain());
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
