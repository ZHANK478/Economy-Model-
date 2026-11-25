import {soundtrackTracks} from './soundtrack-tracks.js';

const preferenceKey = 'whips-music-enabled';
const playlists = Object.fromEntries(['menu', 'normal', 'crisis'].map(mood => [
  mood, soundtrackTracks.filter(track => track.mood === mood),
]));

export function campaignMusicMood(state) {
  return state.defense?.war || state.defense?.crisis || state.government?.defaultActive
    ? 'crisis'
    : 'normal';
}

export function musicField() {
  return `<label><input type="checkbox" data-music-enabled ${music.enabled ? 'checked' : ''}> Музыка</label>`;
}

export function soundtrackLink(language) {
  return `<a href="./soundtrack.html?lang=${language}" target="_blank" rel="noopener">Музыка и авторство</a>`;
}

function createMusicPlayer() {
  const audio = new Audio();
  audio.id = 'background-music';
  audio.volume = .25;
  audio.preload = 'none';
  document.body.append(audio);
  const index = {menu: 0, normal: 0, crisis: 0};
  let enabled = true;
  try { enabled = localStorage.getItem(preferenceKey) !== 'off'; } catch {}
  let mood;
  let autoplayBlocked = false;

  function play() {
    if (!mood || !enabled || document.hidden || !audio.paused) return;
    audio.play().then(() => {
      autoplayBlocked = false;
    }, error => {
      if (error.name === 'NotAllowedError') autoplayBlocked = true;
    });
  }

  function loadTrack() {
    const track = playlists[mood][index[mood]];
    audio.pause();
    audio.dataset.mood = mood;
    audio.src = new URL(`../assets/soundtrack/${track.id}.mp3`, import.meta.url).href;
    audio.loop = mood === 'menu';
    play();
  }

  audio.addEventListener('ended', () => {
    index[mood] = (index[mood] + 1) % playlists[mood].length;
    loadTrack();
  });
  function unlock(event) {
    if (event.isTrusted && autoplayBlocked) play();
  }
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => document.hidden ? audio.pause() : play());
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-music-enabled]')) return;
    enabled = event.target.checked;
    try { localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch {}
    for (const checkbox of document.querySelectorAll('[data-music-enabled]')) checkbox.checked = enabled;
    if (enabled) play();
    else audio.pause();
  });

  return {
    get enabled() { return enabled; },
    setMood(nextMood) {
      if (nextMood === mood) return;
      mood = nextMood;
      loadTrack();
    },
  };
}

let player;
export const music = {
  get enabled() { return player?.enabled ?? true; },
  setMood(mood) {
    if (typeof Audio !== 'function') return;
    (player ??= createMusicPlayer()).setMood(mood);
  },
};
