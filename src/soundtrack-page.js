import {soundtrackTracks} from './soundtrack-tracks.js';

const english = new URLSearchParams(location.search).get('lang') === 'en';
const t = (ru, en) => english ? en : ru;
const sections = {
  menu: t('Главное меню', 'Main menu'),
  normal: t('Обычные ходы', 'Regular turns'),
  crisis: t('Кризис', 'Crisis'),
};
const heading = t('Музыка и авторство', 'Soundtrack and credits');
const audio = document.querySelector('audio');
const playing = document.querySelector('#playing');
let selected;

document.documentElement.lang = english ? 'en' : 'ru';
document.title = `${heading} · Mandatewright`;
document.querySelector('#back').textContent = t('К игре', 'Back to the game');
document.querySelector('#heading').textContent = heading;
document.querySelector('#licenses').textContent = t('Файл лицензий', 'License file');
playing.textContent = t('Выберите запись', 'Choose a recording');

for (const [mood, name] of Object.entries(sections)) {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = name;
  const list = document.createElement('ul');
  for (const track of soundtrackTracks.filter(track => track.mood === mood)) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const label = `${track.composer} · ${t(track.ru, track.en)}`;
    button.type = 'button';
    button.textContent = '▶';
    button.setAttribute('aria-label', `${t('Воспроизвести', 'Play')} ${label}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (selected === button && !audio.paused) {
        audio.pause();
        return;
      }
      if (selected !== button) {
        audio.pause();
        selected = button;
        audio.src = new URL(`../assets/soundtrack/${track.id}.mp3`, import.meta.url).href;
      }
      playing.textContent = label;
      audio.play().catch(error => {
        if (selected === button && error.name !== 'AbortError') {
          playing.textContent = t('Запись не удалось открыть.', 'The recording could not be played.');
        }
      });
    });
    const details = document.createElement('div');
    const trackName = document.createElement('p');
    trackName.textContent = label;
    const credit = document.createElement('small');
    const source = document.createElement('a');
    source.href = track.source;
    source.textContent = t('Источник', 'Source');
    const license = document.createElement('a');
    license.href = {
      'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
      'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    }[track.license] ?? track.source;
    license.textContent = track.license === 'Public domain' ? t('Общественное достояние', 'Public domain') : track.license;
    credit.append(`${track.recording} · `, license, ' · ', source);
    if (track.license === 'CC BY 3.0') credit.append(t(' · MP3, выровнена громкость', ' · MP3, loudness normalized'));
    details.append(trackName, credit);
    item.append(button, details);
    list.append(item);
  }
  section.append(title, list);
  document.querySelector('#tracks').append(section);
}

function updateButtons() {
  for (const button of document.querySelectorAll('#tracks button')) {
    const active = selected === button && !audio.paused;
    button.textContent = active ? '⏸' : '▶';
    button.setAttribute('aria-pressed', String(active));
  }
}
for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, updateButtons);
