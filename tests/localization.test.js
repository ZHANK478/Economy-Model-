import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {CODEX_REGIONS, regionMapImage} from '../src/codex-locations.js';
import {BRITISH_CITIES, cityArticle} from '../src/city-dossier.js';
import english from '../src/localization-en.js';
import {createTranslator, interfaceLocale, seatUnit} from '../src/localization.js';

const translate = createTranslator(english);
test('campaign translations preserve interpolated values and translate nested labels', () => {
  assert.equal(translate('Не хватает 64 мест.'), 'You need 64 more seats.');
  assert.equal(translate('Текущий месяц и места в парламенте'), 'Current month and parliamentary seats');
  assert.equal(translate('43.2% мест'), '43.2% of seats');
  assert.equal(translate('Лондон и его регион на игровой карте'), 'London and its region on the map');
  assert.equal(translate('К началу 2000 года экономика выросла на 4.5% за год. Вестминстер готовится к работе в новом созыве.'),
    'The economy grew by 4.5% year on year as 2000 began. Westminster is preparing for the new parliament.');
});
test('menu labels preserve surrounding whitespace and uppercase styling', () => {
  assert.equal(translate('  НАСТРОЙКИ  '), '  SETTINGS  ');
  assert.equal(translate('English'), 'English');
  assert.equal(translate('Сохранить игру'), 'Save game');
  assert.equal(translate('Загрузить игру'), 'Load game');
  assert.equal(translate('Язык игры'), 'Game language');
  assert.equal(translate('Налог на прибыль'), 'Corporation tax');
  assert.equal(translate('Государственный выкуп: Услуги'), 'State buyout: Services');
  assert.equal(interfaceLocale(), 'ru-RU');
});
test('embedded variables survive English translation, including reordered and repeated values', () => {
  const example = createTranslator([['[[0]] и [[1]]', '[[1]] and [[0]] ([[1]])']]);
  assert.equal(example('Alpha и Beta'), 'Beta and Alpha (Beta)');
});

test('every region has both map languages, and city articles use the supplied photo files', async () => {
  for (const {id} of CODEX_REGIONS) {
    assert.match(regionMapImage(id, 'en'), /-en\.webp$/);
    assert.doesNotMatch(regionMapImage(id, 'ru'), /-en\.webp$/);
    await access(new URL('../'+regionMapImage(id, 'en'), import.meta.url));
    await access(new URL('../'+regionMapImage(id, 'ru'), import.meta.url));
  }
  for (const city of BRITISH_CITIES) {
    assert.ok(city.photo);
    assert.ok(cityArticle(city).includes(city.photo));
    await access(new URL('../'+city.photo, import.meta.url));
  }
});


test('seat labels agree with counts in both languages', () => {
  assert.deepEqual([1, 4, 11, 21, 84, 300].map(count => seatUnit(count, 'ru')),
    ['место', 'места', 'мест', 'место', 'места', 'мест']);
  assert.deepEqual([1, 4, 11, 21, 84, 300].map(count => seatUnit(count, 'en')),
    ['seat', 'seats', 'seats', 'seats', 'seats', 'seats']);
  assert.equal(translate('Состав ВВП региона'), 'Breakdown of regional GDP');
  assert.equal(translate('Коалиционное соглашение: Либеральная партия'), 'Coalition agreement: Liberal Party');
});
