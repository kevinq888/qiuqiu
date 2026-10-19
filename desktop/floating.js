const widget = document.querySelector('.widget');
const record = document.querySelector('.record');
const close = document.querySelector('.close');
const track = document.querySelector('.track');

record.addEventListener('click', () => window.qiuqiuDesktop.openMain());
close.addEventListener('click', event => {
  event.stopPropagation();
  window.qiuqiuDesktop.quit();
});
window.qiuqiuDesktop.onPlaybackState(state => {
  widget.classList.toggle('is-playing', !!state.playing);
  track.textContent = state.hasTrack ? state.title : '秋秋音乐';
});
