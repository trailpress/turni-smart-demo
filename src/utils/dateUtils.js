export function formatDateLabel(date) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

const MONTHS = {
  gennaio: 0,
  gen: 0,
  febbraio: 1,
  feb: 1,
  marzo: 2,
  mar: 2,
  aprile: 3,
  apr: 3,
  maggio: 4,
  mag: 4,
  giugno: 5,
  giu: 5,
  luglio: 6,
  lug: 6,
  agosto: 7,
  ago: 7,
  settembre: 8,
  set: 8,
  sett: 8,
  ottobre: 9,
  ott: 9,
  novembre: 10,
  nov: 10,
  dicembre: 11,
  dic: 11,
};

const WEEKDAYS = /\b(lunedi|lunedì|lun|martedi|martedì|mar|mercoledi|mercoledì|mer|giovedi|giovedì|gio|venerdi|venerdì|ven|sabato|sab|domenica|dom)\b/gi;

function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/.\-\s]/g, ' ')
    .replace(WEEKDAYS, ' ')
    .replace(/\b(il|del|giorno|data|turno)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandYear(value, refYear) {
  if (!value) return refYear;
  const year = Number(value);
  if (Number.isNaN(year)) return refYear;
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function makeValidDate(year, month, day) {
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

export function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseNaturalDate(text, refYear = new Date().getFullYear()) {
  const rawValue = String(text || '').trim().toLowerCase();
  const value = normalizeSearchText(rawValue);
  if (!value) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/\boggi\b/.test(value)) return today;
  if (/\bdomani\b/.test(value)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }
  if (/\bdopodomani\b/.test(value)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 2);
    return date;
  }
  if (/\bieri\b/.test(value)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return date;
  }

  const relativeDays = value.match(/\b(?:tra|fra)\s+(\d{1,2})\s+(?:giorni|gg)\b/);
  if (relativeDays) {
    const date = new Date(today);
    date.setDate(date.getDate() + Number(relativeDays[1]));
    return date;
  }

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return makeValidDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const numeric = value.match(/\b(\d{1,2})[\/.\-\s](\d{1,2})(?:[\/.\-\s](\d{2,4}))?\b/);
  if (numeric) return makeValidDate(expandYear(numeric[3], refYear), Number(numeric[2]) - 1, Number(numeric[1]));

  const compactNumeric = value.match(/\b(\d{2})(\d{2})(\d{2,4})\b/);
  if (compactNumeric) {
    return makeValidDate(expandYear(compactNumeric[3], refYear), Number(compactNumeric[2]) - 1, Number(compactNumeric[1]));
  }

  const named = value.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{2,4}))?\b/i);
  if (named && MONTHS[named[2]] !== undefined) {
    return makeValidDate(expandYear(named[3], refYear), MONTHS[named[2]], Number(named[1]));
  }

  const nextDays = value.match(/^prossimi\s+(\d{1,2})\s+giorni$/);
  if (nextDays) {
    const amount = Number(nextDays[1]);
    return Array.from({ length: amount }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() + index);
      return date;
    });
  }

  return null;
}
