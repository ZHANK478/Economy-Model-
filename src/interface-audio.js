const preferenceKey = 'whips-interface-sounds';
const controls = 'button, a[href], summary, [role="button"]';
const cues = [
  ['month', '[data-action="step"], [data-action="run3"], [data-action="run12"]'],
  ['paper', '[data-strategy-news], [data-press-headline], [data-press-paper], [data-press-issue], .press-reader button:not([data-close-button])'],
  ['close', '[data-close-button], [data-atlas-dismiss], [data-save-action="close"], [data-save-action="cancel"], .country-back, .campaign-leader-back:first-child, [data-action$="-close"]'],
  ['stamp', '[data-parliament], [data-party-line], [data-political-action], [data-campaign-choice], [data-government-milestone], [data-request-accept], [data-world-decision], [data-request-dismiss], [data-action="charter-vote"], [data-scenario-exit], .country-launch, .campaign-leader-back:last-child'],
  ['file', '[data-save-action], .campaign-save-form button[type="submit"], [data-action="save-game"], [data-action="load-game"], [data-menu="load"]'],
  ['map', '[data-atlas-world], [data-atlas-zoom], [data-atlas-dossier], [data-atlas-city], [data-atlas-foreign], [data-atlas-home], [data-atlas-request]'],
  ['open', '[data-menu], [data-category], [data-view], [data-atlas-gdp], [data-atlas-summary], [data-language], [data-action$="-open"]'],
];
const samples = new Map();
let enabled = true;
try { enabled = localStorage.getItem(preferenceKey) !== 'off'; } catch {}

const isAndroid = () => document.documentElement?.dataset?.platform === 'android';

export function interfaceSoundField() {
  if (isAndroid()) return '';
  return `<label><input type="checkbox" data-interface-sounds ${enabled ? 'checked' : ''}> Звуки интерфейса</label>`;
}

export function playInterfaceSound(cue) {
  if (!enabled || document.hidden || isAndroid() || typeof Audio !== 'function') return;
  if (!samples.has(cue)) {
    const sound = new Audio(new URL(`../assets/interface-audio/${cue}.wav`, import.meta.url).href);
    sound.volume = .5;
    sound.dataset.interfaceCue = cue;
    sound.hidden = true;
    document.body.append(sound);
    samples.set(cue, sound);
  }
  const sound = samples.get(cue);
  sound.currentTime = 0;
  void sound.play().catch(() => {});
}

export function mountInterfaceSounds() {
  if (isAndroid()) return;
  // Capture the original control before the game replaces its panel on click.
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const control = event.target.closest(controls);
    if (!control || control.matches(':disabled, [aria-disabled="true"], [data-atlas-region]') ||
        control.closest('[inert]')) return;
    if (control.matches('a[href]') && !control.closest('#main-menu, #app, dialog')) return;
    playInterfaceSound(cues.find(([, selector]) => control.matches(selector))?.[0] ?? 'click');
  }, true);
  document.addEventListener('change', event => {
    if (event.target.matches('[data-interface-sounds]')) {
      enabled = event.target.checked;
      try { localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch {}
      for (const checkbox of document.querySelectorAll('[data-interface-sounds]')) checkbox.checked = enabled;
      if (!enabled) for (const sound of samples.values()) sound.pause();
      playInterfaceSound('click');
    } else if (event.isTrusted && event.target.matches('select, input[type="checkbox"], input[type="radio"]')) {
      playInterfaceSound('click');
    }
  }, true);
}
