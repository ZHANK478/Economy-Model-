import {readDevicePreference,writeDevicePreference} from './storage.js';

const cyrillic = /\p{Script=Cyrillic}/u;
const words = /\p{Script=Cyrillic}+/gu;
const slot = /\[\[(\d+)\]\]/g;
const slots = /\[\[\d+\]\]/;
const normalize = text => text.trim().replace(/\s+/gu, ' ');
function localizeValue(value) {
  if (!/^[+−-]?\d+(?: \d{3})*(?:,\d{1,2})?$/u.test(value)) return value;
  const [whole, decimals] = value.split(',');
  return whole.replaceAll(' ', ',') + (decimals ? '.' + decimals : '');
}
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const labels = ['title', 'aria-label', 'aria-description', 'aria-valuetext', 'alt', 'placeholder', 'summary'];
const labelSelector = labels.map(label => `[${label}]`).join(',');
const ignored = 'script, style, textarea, [contenteditable], [data-locale-fixed]';
let language = 'ru';
let translateCurrent = text => text;
let observer;
const localizedNodes = new WeakMap();
const localizedLabels = new WeakMap();
const languageKey = 'whips-interface-language';
let englishTranslator;

export function createTranslator(entries) {
  const exact = new Map();
  const phrases = new Map();
  const templates = new Map();
  const cache = new Map();

  for (const [ru, en] of entries) {
    const key = ru.toLowerCase();
    const anchors = key.match(words) ?? [];
    if (!anchors.length) continue;
    if (slots.test(ru)) {
      const parts = ru.split(slot);
      const ids = parts.filter((_, index) => index % 2 === 1).map(Number);
      const anchor = anchors.reduce((a, b) => b.length > a.length ? b : a);
      const pattern = parts.map((part, index) => index % 2 === 1 ? '(.*?)' : escapePattern(part)).join('');
      const list = templates.get(anchor) ?? [];
      list.push({ pattern: new RegExp('^' + pattern + '$', 'isu'), en, ids, length: parts.filter((_, i) => i % 2 === 0).join('').length });
      templates.set(anchor, list);
    } else {
      if (!exact.has(key) || key === ru) exact.set(key, en);
      const anchor = anchors[0];
      const list = phrases.get(anchor) ?? new Set();
      list.add(key);
      phrases.set(anchor, list);
    }
  }

  for (const list of templates.values()) list.sort((a, b) => b.length - a.length);
  for (const [anchor, set] of phrases) {
    const options = [...set].sort((a, b) => b.length - a.length).map(escapePattern);
    phrases.set(anchor, new RegExp('(?<![\\p{L}\\p{N}])(?:' + options.join('|') + ')(?!\\p{L})', 'giu'));
  }

  function translate(text, depth = 0) {
    if (typeof text !== 'string' || !cyrillic.test(text)) return text;
    const key = normalize(text);
    const lower = key.toLowerCase();
    const leading = text.match(/^\s*/u)[0], trailing = text.match(/\s*$/u)[0];
    let result = depth === 0 ? cache.get(key) : undefined;
    if (result === undefined) {
      result = exact.get(lower);
      const anchors = new Set(lower.match(words));
      if (result === undefined && depth < 3) {
        let best;
        for (const anchor of anchors) {
          for (const item of templates.get(anchor) ?? []) {
            if (best && item.length <= best.item.length) break;
            const match = item.pattern.exec(key);
            if (match) { best = { item, match }; break; }
          }
        }
        if (best) {
          const values = [];
          best.item.ids.forEach((id, index) => { values[id] = best.match[index + 1]; });
          result = best.item.en.replace(slot, (_, id) => translate(localizeValue(values[id] ?? ''), depth + 1));
        }
      }
      if (result === undefined) {
        const ranges = [];
        for (const anchor of anchors) {
          const pattern = phrases.get(anchor);
          if (!pattern) continue;
          for (const match of key.matchAll(pattern)) {
            ranges.push({ start: match.index, text: match[0] });
          }
        }
        ranges.sort((a, b) => a.start - b.start || b.text.length - a.text.length);
        let offset = 0;
        result = '';
        for (const { start, text } of ranges) {
          if (start < offset) continue;
          result += key.slice(offset, start) + exact.get(text.toLowerCase());
          offset = start + text.length;
        }
        result += key.slice(offset);
      }
      if (key === key.toUpperCase() && key !== lower && !/[a-z]/.test(key)) result = result.toUpperCase();
      if (depth === 0 && cache.size < 16000) cache.set(key, result);
    }
    return leading + result + trailing;
  }
  return translate;
}

export function activeLanguage() { return language; }
export function interfaceLocale() { return language === 'en' ? 'en-GB' : 'ru-RU'; }
export function interfaceNumberFormatter(options) {
  const formats = new Map();
  return { format(value) {
    const locale = interfaceLocale();
    if (!formats.has(locale)) formats.set(locale, new Intl.NumberFormat(locale, options));
    return formats.get(locale).format(value);
  } };
}
export function translateText(text) { return translateCurrent(text); }

const russianPlural = new Intl.PluralRules('ru-RU');
const seatForms = {one: 'место', few: 'места', many: 'мест'};
export function seatUnit(count, locale = language) {
  if (locale === 'en') return count === 1 ? 'seat' : 'seats';
  return seatForms[russianPlural.select(count)] ?? 'мест';
}

function localizeLabel(element, label) {
  const current = element.getAttribute(label);
  const previous = localizedLabels.get(element)?.get(label);
  const source = current === previous?.translation ? previous.source : current;
  const translation = translateText(source);
  if (translation !== source) {
    if (!localizedLabels.has(element)) localizedLabels.set(element, new Map());
    localizedLabels.get(element).set(label, {source, translation});
  } else {
    localizedLabels.get(element)?.delete(label);
  }
  if (translation !== current) element.setAttribute(label, translation);
}

function localizeText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(ignored)) return;
  const previous = localizedNodes.get(node);
  const source = node.data === previous?.translation ? previous.source : node.data;
  const translation = translateText(source);
  if (translation !== source) {
    if (parent.localName === 'option' && !parent.hasAttribute('value')) parent.value = parent.value;
    localizedNodes.set(node, {source, translation});
  } else {
    localizedNodes.delete(node);
  }
  if (translation !== node.data) node.data = translation;
}

function localizeTree(element) {
  if (element.nodeType === Node.TEXT_NODE) { localizeText(element); return; }
  if (element.nodeType !== Node.ELEMENT_NODE || element.closest(ignored)) return;
  for (const label of labels) localizeLabel(element, label);
  for (const item of element.querySelectorAll(labelSelector)) {
    if (!item.closest(ignored)) for (const label of labels) localizeLabel(item, label);
  }
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) localizeText(node);
}

export async function savedLanguage() {
  const value = await readDevicePreference(languageKey);
  return value === 'ru' || value === 'en' ? value : null;
}

export async function setGameLanguage(selected) {
  await startLocalization(selected);
  await writeDevicePreference(languageKey, language);
}

export function languageField() {
  return `<label class="language-field"><span>Язык игры</span>
    <select data-game-language>
      <option value="en" lang="en" data-locale-fixed ${language === 'en' ? 'selected' : ''}>English</option>
      <option value="ru" lang="ru" data-locale-fixed ${language === 'ru' ? 'selected' : ''}>Русский</option>
    </select>
  </label>`;
}

export async function startLocalization(selected) {
  const next = selected === 'en' ? 'en' : 'ru';
  if (next === 'en' && !englishTranslator) {
    const {default: english} = await import('./localization-en.js');
    englishTranslator = createTranslator(english);
  }
  document.documentElement.lang = next;
  if (next === language) return;

  observer?.disconnect();
  language = next;
  translateCurrent = next === 'en' ? englishTranslator : text => text;
  const description = document.querySelector('meta[name=description]');
  if (description) localizeLabel(description, 'content');
  localizeTree(document.body);
  if (next === 'ru') return;

  observer ??= new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (!record.target.closest(ignored)) localizeLabel(record.target, record.attributeName);
      } else if (record.type === 'characterData') localizeText(record.target);
      else for (const node of record.addedNodes) localizeTree(node);
    }
  });
  observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: labels});
}
