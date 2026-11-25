import {playtestAnalytics} from './playtest-analytics.js';
import {installAnalyticsDiagnostics} from './analytics-diagnostics.js';
import {mountInterfaceSounds} from './interface-audio.js';
import {savedLanguage, setGameLanguage} from './localization.js';

async function chooseGameLanguage() {
  const picker = document.querySelector('#game-language');
  const language = await savedLanguage() ?? await new Promise(resolve => {
    picker.addEventListener('cancel', event => event.preventDefault());
    picker.addEventListener('click', event => {
      const button = event.target.closest('button[data-language]');
      if (button) {
        for (const option of picker.querySelectorAll('button')) option.disabled = true;
        resolve(button.dataset.language);
      }
    });
    picker.showModal();
  });
  await setGameLanguage(language);
  picker.remove();
}

installAnalyticsDiagnostics(playtestAnalytics);
mountInterfaceSounds();
await chooseGameLanguage();
await import('./app.js');
