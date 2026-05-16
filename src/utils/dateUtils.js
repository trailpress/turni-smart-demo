export function formatDateLabel(date) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

const MONTHS = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

export function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseNaturalDate(text, refYear = new Date().getFullYear()) {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (value === 'oggi') return today;
  if (value === 'domani') {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }
  if (value === 'dopodomani') {
    const date = new Date(today);
    date.setDate(date.getDate() + 2);
    return date;
  }

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (slash) return new Date(slash[3] ? Number(slash[3]) : refYear, Number(slash[2]) - 1, Number(slash[1]));

  const named = value.match(/^(\d{1,2})\s+([a-zà-ù]+)$/i);
  if (named && MONTHS[named[2]] !== undefined) return new Date(refYear, MONTHS[named[2]], Number(named[1]));

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
