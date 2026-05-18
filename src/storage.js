const LEGACY_PRECO_PREFIX = 'ts_preco_v3_';
const LEGACY_ORARI_PREFIX = 'ts_orari_v20_';
const INDEX_KEY = 'ts_index';
const LAST_PRECO_KEY = 'ts_last_preco';
const LAST_ORARI_KEY = 'ts_last_orari';
const PREFS_KEY = 'turni-smart-prefs';
const BACKUP_VERSION = 1;

function canUseStorage() {
  try {
    const key = '_turni_smart_test';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readJson(key, fallback = null) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function deleteKey(key) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // localStorage non disponibile: nessuna azione necessaria.
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function preconoscenzaKey(year, month) {
  return `${LEGACY_PRECO_PREFIX}${year}-${pad(month)}`;
}

export function orariKey(year, month) {
  return `${LEGACY_ORARI_PREFIX}${year}-${pad(month)}`;
}

function monthFromPreconoscenza(info) {
  const date = info?.dIn ? new Date(info.dIn) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function serializePreconoscenza({ days, dIn, dTe, fileName, matricola, nome }) {
  return {
    days: days || {},
    dIn: dIn ? new Date(dIn).toISOString() : null,
    dTe: dTe ? new Date(dTe).toISOString() : null,
    fileName: fileName || '',
    matricola: matricola || '',
    nome: nome || '',
  };
}

export function deserializePreconoscenza(value) {
  if (!value) return null;
  const days = Object.entries(value.days || {}).reduce((acc, [iso, day]) => {
    acc[iso] = {
      ...day,
      iso: day?.iso || iso,
      date: day?.date ? new Date(day.date) : new Date(`${iso}T00:00:00`),
    };
    return acc;
  }, {});
  return {
    days,
    dIn: value.dIn ? new Date(value.dIn) : null,
    dTe: value.dTe ? new Date(value.dTe) : null,
    fileName: value.fileName || '',
    matricola: value.matricola || '',
    nome: value.nome || '',
  };
}

function updateIndex(entry) {
  const index = getHistory().filter((item) => item.key !== entry.key);
  index.push({ ...entry, savedAt: new Date().toISOString() });
  index.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
  writeJson(INDEX_KEY, index);
}

export function savePreconoscenza(info) {
  const month = monthFromPreconoscenza(info);
  if (!month) return false;
  const key = preconoscenzaKey(month.year, month.month);
  const ok = writeJson(key, serializePreconoscenza(info));
  if (!ok) return false;
  writeJson(LAST_PRECO_KEY, key);
  updateIndex({
    type: 'preconoscenza',
    key,
    label: info?.nome || info?.fileName || 'Preconoscenza',
    year: month.year,
    month: month.month,
  });
  return true;
}

export function saveOrari(developments, info) {
  const month = monthFromPreconoscenza(info);
  if (!month || !developments || !Object.keys(developments).length) return false;
  const key = orariKey(month.year, month.month);
  const ok = writeJson(key, developments);
  if (!ok) return false;
  writeJson(LAST_ORARI_KEY, key);
  updateIndex({
    type: 'orari',
    key,
    label: info?.fileName || 'Orari Linee',
    year: month.year,
    month: month.month,
  });
  return true;
}

export function getHistory() {
  return readJson(INDEX_KEY, []);
}

export function loadPreconoscenzaByKey(key) {
  return deserializePreconoscenza(readJson(key));
}

export function loadOrariByKey(key) {
  return readJson(key, {});
}

export function loadLastPreconoscenza() {
  const key = readJson(LAST_PRECO_KEY);
  return key ? loadPreconoscenzaByKey(key) : null;
}

export function loadLastOrari() {
  const key = readJson(LAST_ORARI_KEY);
  return key ? loadOrariByKey(key) : {};
}

export function deleteHistoryEntry(key) {
  deleteKey(key);
  writeJson(INDEX_KEY, getHistory().filter((item) => item.key !== key));
  if (readJson(LAST_PRECO_KEY) === key) deleteKey(LAST_PRECO_KEY);
  if (readJson(LAST_ORARI_KEY) === key) deleteKey(LAST_ORARI_KEY);
}

export function loadPreferences() {
  return readJson(PREFS_KEY, {});
}

export function savePreferences(preferences) {
  return writeJson(PREFS_KEY, preferences || {});
}

export function buildBackup() {
  const keys = [];
  if (canUseStorage()) {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('ts_') || key === PREFS_KEY) keys.push(key);
    }
  }

  return {
    app: 'turni-smart',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: keys.reduce((acc, key) => {
      acc[key] = readJson(key);
      return acc;
    }, {}),
  };
}

export function restoreBackup(backup) {
  if (backup?.app !== 'turni-smart' || !backup.items || typeof backup.items !== 'object') {
    throw new Error('Backup non riconosciuto.');
  }

  Object.entries(backup.items).forEach(([key, value]) => {
    if (key.startsWith('ts_') || key === PREFS_KEY) writeJson(key, value);
  });

  return getHistory();
}
