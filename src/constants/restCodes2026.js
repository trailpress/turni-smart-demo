export const DEFAULT_REST_CODE = '2';

export const REST_CODE_2_2026 = [
  ['2026-01-03', 'RP'],
  ['2026-01-04', 'TA'],
  ['2026-01-09', 'RP'],
  ['2026-01-15', 'RP'],
  ['2026-01-21', 'RP'],
  ['2026-01-27', 'RP'],
  ['2026-02-01', 'FS'],
  ['2026-02-02', 'SL'],
  ['2026-02-07', 'MP'],
  ['2026-02-08', 'RP'],
  ['2026-02-14', 'RP'],
  ['2026-02-15', 'MP'],
  ['2026-02-20', 'RP'],
  ['2026-02-26', 'RP'],
  ['2026-03-04', 'RP'],
  ['2026-03-10', 'RP'],
  ['2026-03-15', 'FS'],
  ['2026-03-16', 'SL'],
  ['2026-03-21', 'MP'],
  ['2026-03-22', 'RP'],
  ['2026-03-28', 'RP'],
  ['2026-03-29', 'FS'],
  ['2026-04-03', 'RP'],
  ['2026-04-09', 'RP'],
  ['2026-04-15', 'RP'],
  ['2026-04-21', 'RP'],
  ['2026-04-26', 'TA'],
  ['2026-04-27', 'SL'],
  ['2026-05-02', 'MP'],
  ['2026-05-03', 'RP'],
  ['2026-05-09', 'RP'],
  ['2026-05-10', 'MP'],
  ['2026-05-15', 'RP'],
  ['2026-05-21', 'RP'],
  ['2026-05-27', 'RP'],
  ['2026-06-02', 'RP'],
  ['2026-06-07', 'TA'],
  ['2026-06-08', 'SL'],
  ['2026-06-13', 'MP'],
  ['2026-06-14', 'RP'],
  ['2026-06-20', 'RP'],
  ['2026-06-21', 'TA'],
  ['2026-06-26', 'RP'],
  ['2026-07-02', 'RP'],
  ['2026-07-08', 'RP'],
  ['2026-07-14', 'RP'],
  ['2026-07-19', 'FS'],
  ['2026-07-20', 'SL'],
  ['2026-07-25', 'MP'],
  ['2026-07-26', 'RP'],
  ['2026-08-01', 'RP'],
  ['2026-08-02', 'MP'],
  ['2026-08-07', 'RP'],
  ['2026-08-13', 'RP'],
  ['2026-08-19', 'RP'],
  ['2026-08-25', 'RP'],
  ['2026-08-30', 'FS'],
  ['2026-08-31', 'SL'],
  ['2026-09-05', 'MP'],
  ['2026-09-06', 'RP'],
  ['2026-09-12', 'RP'],
  ['2026-09-13', 'FS'],
  ['2026-09-18', 'RP'],
  ['2026-09-24', 'RP'],
  ['2026-09-30', 'RP'],
  ['2026-10-06', 'RP'],
  ['2026-10-11', 'TA'],
  ['2026-10-12', 'SL'],
  ['2026-10-17', 'MP'],
  ['2026-10-18', 'RP'],
  ['2026-10-24', 'RP'],
  ['2026-10-25', 'MP'],
  ['2026-10-30', 'RP'],
  ['2026-11-05', 'RP'],
  ['2026-11-11', 'RP'],
  ['2026-11-17', 'RP'],
  ['2026-11-22', 'TA'],
  ['2026-11-23', 'SL'],
  ['2026-11-28', 'MP'],
  ['2026-11-29', 'RP'],
  ['2026-12-05', 'RP'],
  ['2026-12-06', 'TA'],
  ['2026-12-11', 'RP'],
  ['2026-12-17', 'RP'],
  ['2026-12-23', 'RP'],
  ['2026-12-29', 'RP'],
];

const REST_CODE_SCHEDULES_2026 = {
  [DEFAULT_REST_CODE]: REST_CODE_2_2026,
};

function parseIsoDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysBetween(from, to) {
  return Math.round((parseIsoDate(toIsoDate(to)) - parseIsoDate(toIsoDate(from))) / 86400000);
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function getBaseRestSequence(restCode) {
  const entries = REST_CODE_SCHEDULES_2026[String(restCode)] || [];
  return entries.filter(([, code]) => code !== 'TA');
}

function buildRotation(restCode) {
  const base = getBaseRestSequence(restCode).map(([iso, code]) => ({ date: parseIsoDate(iso), code }));
  const intervals = base.slice(1).map((entry, index) => daysBetween(base[index].date, entry.date));
  return { base, intervals };
}

export function getOfficialRestEntries(year, restCode = DEFAULT_REST_CODE) {
  const targetYear = Number(year);
  if (!Number.isFinite(targetYear)) return [];

  const { base, intervals } = buildRotation(restCode);
  if (!base.length || !intervals.length) return [];

  const targetStart = new Date(targetYear, 0, 1);
  const targetEnd = new Date(targetYear, 11, 31);

  if (targetYear === 2026) {
    return base
      .filter((entry) => entry.date >= targetStart && entry.date <= targetEnd)
      .map((entry) => [toIsoDate(entry.date), entry.code]);
  }

  const generated = [];
  let date = new Date(base[0].date);
  let index = 0;

  if (targetYear > 2026) {
    while (date <= targetEnd) {
      if (date >= targetStart) generated.push([toIsoDate(date), base[positiveModulo(index, base.length)].code]);
      date = addDays(date, intervals[positiveModulo(index, intervals.length)]);
      index += 1;
    }
    return generated;
  }

  date = new Date(base[0].date);
  index = 0;
  while (date >= targetStart) {
    if (date <= targetEnd) generated.push([toIsoDate(date), base[positiveModulo(index, base.length)].code]);
    index -= 1;
    const interval = intervals[positiveModulo(index, intervals.length)];
    date = addDays(date, -interval);
  }

  return generated.sort(([a], [b]) => a.localeCompare(b));
}
