import { isGerbidoLine as checkGerbidoLine, normalizeLineCode } from './constants/depotGerbido.js';
import { isEveningShift as officialEveningShift } from './constants/shiftClassification.js';

export const SPECIAL_CODES = {
  RP: { label: 'RIPOSO', description: 'Giornata libera' },
  RIS: { label: 'BALLOTTAGGIO', description: 'Turno da assegnare' },
  FS: { label: 'FESTA SOPPRESSA', description: 'Giornata libera' },
  SL: { label: 'SOSTA LUNGA', description: 'Giornata libera' },
  MP: { label: 'MANCATA PREST.', description: 'Giornata libera' },
};

export const REST_CODES = {
  RP: true,
  FS: true,
  SL: true,
  MP: true,
};

const SHIFT_LINE_RE = /(\d{2}\/\d{2}\/\d{4})\s+(DOM|LUN|MAR|MER|GIO|VEN|SAB)\s+(.*)/;

export function parseDMY(value) {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
}

export function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCompactTime(value) {
  if (!value) return '--:--';
  return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
}

export function parseShift(rest) {
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length < 8) return null;

  const geIndex = tokens.findIndex((token) => token === 'GE');
  if (geIndex < 0 || geIndex + 2 >= tokens.length) return null;

  const line = tokens[0];
  const lineNorm = normalizeLineCode(line);
  const number = tokens[geIndex + 1];
  const code = tokens[geIndex + 2];
  const after = tokens.slice(geIndex + 3);
  const times = [];
  const places = [];
  const directions = [];

  after.forEach((token) => {
    if (/^\d{4}$/.test(token)) {
      times.push(token);
    } else if (/^[A-Z]{2,4}$/.test(token)) {
      places.push(token);
      directions.push('');
    } else if (/^[AR]$/.test(token) && directions.length > 0) {
      directions[directions.length - 1] = token;
    }
  });

  return {
    t: 'turno',
    l: line,
    linea: line,
    lineaNorm: lineNorm,
    isGerbidoLine: checkGerbidoLine(line),
    n: number,
    c: code,
    i: times[0] || '',
    li: places[0] || '',
    di: directions[0] || '',
    e: times[1] || '',
    le: places[1] || '',
    de: directions[1] || '',
    d: times[2] || '',
  };
}

export function parsePreconoscenza(text) {
  const lines = String(text || '').split('\n');
  const days = {};
  let nome = '';
  let matricola = '';
  let dIn = null;
  let dTe = null;
  const allText = String(text || '').replace(/\n/g, ' ');

  let nameMatch = allText.match(/Nominativo[:\s]+([A-Z][A-Z\s]+?)(?:\s{2,}|\s*$)/i);
  if (nameMatch) nome = nameMatch[1].trim();
  if (!nome) {
    nameMatch = allText.match(/Nominativo[:\s]+(.+?)(?:Stabilimento|Data|Gr\.|$)/i);
    if (nameMatch) nome = nameMatch[1].trim();
  }
  if (!nome) {
    lines.some((raw) => {
      const match = raw.match(/Nominativo[:\s]+([A-Z][A-Za-z\s]+)/i);
      if (match) nome = match[1].trim();
      return Boolean(nome);
    });
  }

  let codeMatch = allText.match(/Codice\s*Personale[:\s]*(\d+)/i);
  if (codeMatch) matricola = codeMatch[1];
  if (!matricola) {
    lines.some((raw) => {
      const match = raw.match(/Codice\s*Personale[:\s]*(\d+)/i);
      if (match) matricola = match[1];
      return Boolean(matricola);
    });
  }

  lines.forEach((raw) => {
    const line = raw.trim();
    const startMatch = line.match(/Data\s*Inizio:?\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (startMatch) dIn = parseDMY(startMatch[1]);
    const endMatch = line.match(/Data\s*Termine:?\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (endMatch) dTe = parseDMY(endMatch[1]);
  });

  lines.forEach((raw) => {
    const match = raw.trim().match(SHIFT_LINE_RE);
    if (!match) return;

    const [, dateString, weekday, restRaw] = match;
    const date = parseDMY(dateString);
    const iso = toIso(date);
    const rest = restRaw.trim();
    const tokens = rest.split(/\s+/).filter(Boolean);
    const first = (tokens[0] || '').toUpperCase();

    if (SPECIAL_CODES[first]) {
      const entry = {
        iso,
        date,
        t: first,
        g: weekday,
        x: tokens.slice(1).join(' '),
      };
      if (first === 'RIS') {
        const ballot = tokens.find((token) => /^B\d{2}$/.test(token)) || '';
        entry.ball = ballot;
      }
      days[iso] = entry;
      return;
    }

    const shift = parseShift(rest);
    if (shift) {
      days[iso] = {
        iso,
        date,
        g: weekday,
        ...shift,
      };
    }
  });

  if (!dIn || !dTe) {
    const sorted = Object.keys(days).sort();
    if (sorted.length) {
      if (!dIn) dIn = new Date(`${sorted[0]}T00:00:00`);
      if (!dTe) dTe = new Date(`${sorted[sorted.length - 1]}T00:00:00`);
    }
  }

  return {
    days,
    nome,
    matricola,
    dIn,
    dTe,
    rawText: text,
  };
}

export function minutesFromCompactTime(value) {
  if (!value || value.length < 4) return 0;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(2, 4));
}

export function isEveningShift(shift) {
  if (!shift || shift.t !== 'turno' || !shift.i || !shift.e) return false;
  const start = minutesFromCompactTime(shift.i);
  const end = minutesFromCompactTime(shift.e);
  return officialEveningShift(shift.n, start >= 1200 || end < start);
}

export function calcStats(days) {
  const values = Object.values(days || {});
  let totalMinutes = 0;
  const result = {
    totalDays: values.length,
    shifts: 0,
    rests: 0,
    ballots: 0,
    eveningShifts: 0,
    totalMinutes: 0,
  };

  values.forEach((day) => {
    if (!day) return;
    if (day.t === 'turno') {
      result.shifts += 1;
      const start = minutesFromCompactTime(day.i);
      const end = minutesFromCompactTime(day.e);
      totalMinutes += end >= start ? end - start : 1440 - start + end;
      if (isEveningShift(day)) result.eveningShifts += 1;
    } else if (REST_CODES[day.t]) {
      result.rests += 1;
    } else if (day.t === 'RIS') {
      result.ballots += 1;
    }
  });

  result.totalMinutes = totalMinutes;
  return result;
}
