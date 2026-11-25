const PREFIX = 'whips-campaign:';
const AUTO_PREFIX = 'whips-campaign-auto:';
export const autosavePeriod = month => Math.floor(month / 6);

export function campaignSaves(storage, {now = Date.now, makeId = () => crypto.randomUUID()} = {}) {
  async function readAutomatic(key) {
    const value = await storage.get(key);
    try { return typeof value === 'string' ? JSON.parse(value) : value; }
    catch { return null; }
  }

  async function list() {
    const entries = [];
    for (const key of await storage.listKeys(PREFIX)) {
      try {
        const [time, , name, date] = JSON.parse(key.slice(PREFIX.length));
        if (Number.isFinite(time) && typeof name === 'string' && typeof date === 'string') {
          entries.push({key, time, name, date});
        }
      } catch { /* Ignore unrelated or malformed keys. */ }
    }
    for (const key of await storage.listKeys(AUTO_PREFIX)) {
      const record = await readAutomatic(key);
      if (Number.isFinite(record?.time) && typeof record.name === 'string' && typeof record.date === 'string')
        entries.push({key, time:record.time, name:record.name, date:record.date, automatic:true});
    }
    return entries.sort((a, b) => b.time - a.time);
  }

  return {
    list,
    save(name, date, snapshot) {
      const key = PREFIX + JSON.stringify([now(), makeId(), name.trim() || date, date]);
      return storage.set(key, JSON.stringify(snapshot));
    },
    saveAutomatic(campaignId, name, date, snapshot) {
      return storage.set(AUTO_PREFIX + campaignId, {time:now(), name, date, snapshot});
    },
    async load(key) {
      const automatic = key.startsWith(AUTO_PREFIX);
      const record = automatic ? await readAutomatic(key) : key.startsWith(PREFIX) ? await storage.get(key) : null;
      if (!record) throw new Error('Сохранение не найдено.');
      const snapshot = automatic ? record.snapshot : JSON.parse(record);
      const saved = JSON.parse(snapshot.liveText);
      if (!Array.isArray(snapshot.journal)) throw new Error('Повреждён журнал сохранения.');
      saved.simulation.state.journal = snapshot.journal;
      return {...saved.simulation, draftPolicy:saved.draft, newspaper:saved.newspaper, leader:saved.leader,
        campaignId:saved.campaignId ?? key};
    },
    remove(key) {
      if (!key.startsWith(PREFIX) && !key.startsWith(AUTO_PREFIX)) throw new Error('Сохранение не найдено.');
      return storage.remove(key);
    }
  };
}
