import { isGerbidoLine as checkGerbidoLine, normalizeLineCode } from './constants/depotGerbido.js';
import { isEveningShift as officialEveningShift } from './constants/shiftClassification.js';
import { parseNaturalDate } from './utils/dateUtils.js';

export const SPECIAL_CODES = {
  RP: { label: 'RIPOSO', description: '' },
  RIS: { label: 'BALLOTTAGGIO', description: 'Turno da assegnare' },
  FS: { label: 'FESTA SOPPRESSA', description: '' },
  SL: { label: 'SOSTA LUNGA', description: '' },
  MP: { label: 'MANCATA PREST.', description: '' },
};

export const REST_CODES = {
  RP: true,
  FS: true,
  SL: true,
  MP: true,
};

const SHIFT_LINE_RE = /(\d{2}\/\d{2}\/\d{4})\s+(DOM|LUN|MAR|MER|GIO|VEN|SAB)\s+(.*)/;
const CONTINUATION_RE = /^(?:[A-Z0-9/()]+\s*\/\s*)?\d{1,3}?\s*\d{4}\s+[A-Z]{2,4}(?:\s+[AR-])?\s+\d{4}\s+[A-Z]{2,4}/i;
const MONTH_INDEX = {
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
  ottobre: 9,
  ott: 9,
  novembre: 10,
  nov: 10,
  dicembre: 11,
  dic: 11,
};

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

  const hasLineBeforeGe =
    geIndex >= 2 &&
    /^[A-Z0-9/()]+$/.test(tokens[geIndex - 2]) &&
    /^\d{1,3}$/.test(tokens[geIndex - 1]) &&
    normalizeLineCode(tokens[geIndex - 2]);
  const line = hasLineBeforeGe ? tokens[geIndex - 2] : tokens[0];
  const lineNorm = normalizeLineCode(line);
  const number = hasLineBeforeGe ? tokens[geIndex - 1] : tokens[geIndex + 1];
  const code = hasLineBeforeGe ? tokens[geIndex - 3] || '' : tokens[geIndex + 2];
  const after = hasLineBeforeGe ? tokens.slice(geIndex + 1) : tokens.slice(geIndex + 3);
  const stops = [];
  let duration = '';

  for (let index = 0; index < after.length; index += 1) {
    const token = after[index];
    const next = after[index + 1];
    if (/^\d{4}$/.test(token) && /^[A-Z]{2,4}$/.test(next)) {
      const directionToken = after[index + 2];
      stops.push({
        time: token,
        place: next,
        direction: /^[AR]$/.test(directionToken) ? directionToken : '',
      });
      index += /^[AR]$/.test(directionToken) ? 2 : 1;
    } else if (/^\d{4}$/.test(token)) {
      duration = token;
    }
  }

  const firstStop = stops[0] || {};
  const lastStop = stops[stops.length - 1] || {};

  return {
    t: 'turno',
    l: line,
    linea: line,
    lineaNorm: lineNorm,
    isGerbidoLine: checkGerbidoLine(line),
    n: number,
    c: code,
    i: firstStop.time || '',
    li: firstStop.place || '',
    di: firstStop.direction || '',
    e: lastStop.time || '',
    le: lastStop.place || '',
    de: lastStop.direction || '',
    d: duration,
  };
}

function collectShiftRows(lines) {
  const rows = [];
  let current = null;

  lines.forEach((raw) => {
    const line = raw.trim();
    const match = line.match(SHIFT_LINE_RE);
    if (match) {
      if (current) rows.push(current);
      current = {
        dateString: match[1],
        weekday: match[2],
        rest: match[3].trim(),
      };
      return;
    }

    if (!current || !line) return;
    if (/^(Data\s|Nominativo|Codice|Stabilimento|Totale|Pagina)/i.test(line)) return;
    if (CONTINUATION_RE.test(line) || /^\d{4}\s+[A-Z]{2,4}/i.test(line)) {
      current.rest = `${current.rest} ${line}`;
    }
  });

  if (current) rows.push(current);
  return rows;
}

function normalizeCommunicatedTokens(text) {
  const rawTokens = String(text || '')
    .trim()
    .toUpperCase()
    .replace(/[→➡➜]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/([A-Z0-9/()]+)\s*-\s*(\d{3,4})/g, '$1 $2')
    .split(/\s+/)
    .map((token) => token.replace(/[,:;]+$/g, ''))
    .filter(Boolean);
  const tokens = [];

  for (let index = 0; index < rawTokens.length; index += 1) {
    const current = rawTokens[index];
    const next = rawTokens[index + 1];
    const afterNext = rawTokens[index + 2];

    if (/^[A-Z0-9/()]+$/.test(current) && next === '/' && /^\d+$/.test(afterNext)) {
      tokens.push(`${current}/${afterNext}`);
      index += 2;
    } else if (/^[A-Z0-9/()]+\/$/.test(current) && /^\d+$/.test(next)) {
      tokens.push(`${current}${next}`);
      index += 1;
    } else {
      tokens.push(current);
    }
  }

  return tokens;
}

function compactToClock(value) {
  const raw = String(value || '').replace(/\D/g, '');
  return raw.length === 4 ? `${raw.slice(0, 2)}:${raw.slice(2)}` : '';
}

function getWeekdayCode(date) {
  return ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'][date.getDay()] || '';
}

function getCommunicatedService(text, date) {
  const upper = String(text || '').toUpperCase();
  if (/\b(SAB|SABATO)\b/.test(upper)) return 'SABATO';
  if (/\b(DOM|DOMENICA|FEST|FESTIVO|FESTIVI)\b/.test(upper)) return 'FESTIVO';
  if (date?.getDay?.() === 0) return 'FESTIVO';
  if (date?.getDay?.() === 6) return 'SABATO';
  return 'LUN - VEN';
}

function findFlexibleDate(text, fallbackDate = null) {
  const raw = String(text || '');
  const numeric = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (numeric) {
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    const date = new Date(year, Number(numeric[2]) - 1, Number(numeric[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const named = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/\b(\d{1,2})\s+(gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|set|ottobre|ott|novembre|nov|dicembre|dic)(?:\s+(\d{2,4}))?\b/);
  if (named && MONTH_INDEX[named[2]] !== undefined) {
    const year = Number(named[3] ? (named[3].length === 2 ? `20${named[3]}` : named[3]) : fallbackDate?.getFullYear?.() || new Date().getFullYear());
    const date = new Date(year, MONTH_INDEX[named[2]], Number(named[1]));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const natural = parseNaturalDate(raw, fallbackDate?.getFullYear?.() || new Date().getFullYear());
  if (natural instanceof Date && !Number.isNaN(natural.getTime())) return natural;
  return fallbackDate ? new Date(fallbackDate) : null;
}

function stripDateWords(text) {
  return String(text || '')
    .replace(/\b(lunedi|lunedì|lun|martedi|martedì|mar|mercoledi|mercoledì|mer|giovedi|giovedì|gio|venerdi|venerdì|ven|sabato|sab|domenica|dom)\b/gi, ' ')
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}\s+(gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|set|ottobre|ott|novembre|nov|dicembre|dic)(?:\s+\d{2,4})?\b/gi, ' ')
    .replace(/\b(oggi|domani|dopodomani|ieri|festivo|festivi)\b/gi, ' ');
}

function parseManualDevelopment(text, date, fallbackDay = null, service = '', weekday = '') {
  const tokens = normalizeCommunicatedTokens(text);
  const segments = [];
  let line = fallbackDay?.l || '';
  let shiftNumber = fallbackDay?.t === 'turno' ? fallbackDay.n : '';

  const explicitShift = tokens.join(' ').match(/\bLINEA\s+([A-Z0-9()]+)\s+(?:TURNO\s+)?(\d{1,3})\b/);
  if (explicitShift && normalizeLineCode(explicitShift[1])) {
    line = explicitShift[1];
    shiftNumber ||= explicitShift[2];
  }

  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const lineVehicle = tokens[index].match(/^([A-Z0-9/()]+)\/(\d+)$/);
    const hasLineVehicle = Boolean(lineVehicle);
    const startsWithTime = Boolean(compactToClock(tokens[index]));
    if (!hasLineVehicle && !startsWithTime) continue;
    if (startsWithTime && !hasLineVehicle) {
      const previous = segments[segments.length - 1];
      const currentTime = compactToClock(tokens[index]);
      if (previous && (previous.start === currentTime || previous.end === currentTime)) continue;
    }

    const startIndex = hasLineVehicle ? index + 1 : index;
    const placeIndex = hasLineVehicle ? index + 2 : index + 1;
    const directionIndex = hasLineVehicle ? index + 3 : index + 2;
    const hasDirection = /^[AR-]$/.test(tokens[directionIndex]);
    const endIndex = hasDirection ? directionIndex + 1 : directionIndex;
    const endPlaceIndex = hasDirection ? directionIndex + 2 : directionIndex + 1;
    if (!compactToClock(tokens[startIndex]) || !/^[A-Z]{2,4}$/.test(tokens[placeIndex])) continue;
    if (!compactToClock(tokens[endIndex]) || !/^[A-Z]{2,4}$/.test(tokens[endPlaceIndex])) continue;

    if (hasLineVehicle) {
      line = lineVehicle[1];
      shiftNumber ||= lineVehicle[2];
    }

    const nextSegment = {
      ln: line,
      lineaNorm: normalizeLineCode(line),
      vett: hasLineVehicle ? lineVehicle[2] : '',
      turnoVettura: hasLineVehicle ? lineVehicle[2] : '',
      start: compactToClock(tokens[startIndex]),
      loc_s: tokens[placeIndex],
      dir: hasDirection && tokens[directionIndex] !== '-' ? tokens[directionIndex] : '',
      end: compactToClock(tokens[endIndex]),
      loc_e: tokens[endPlaceIndex],
      gt: service,
      ver: '',
      run_id: 1,
      source: 'manual',
    };
    const duplicate = segments.some(
      (segment) =>
        segment.start === nextSegment.start &&
        segment.end === nextSegment.end &&
        segment.loc_s === nextSegment.loc_s &&
        segment.loc_e === nextSegment.loc_e,
    );
    if (!duplicate) segments.push(nextSegment);
  }

  if (!date || !line || !segments.length) return null;
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    iso: toIso(date),
    date,
    g: weekday || fallbackDay?.g || getWeekdayCode(date),
    t: 'turno',
    l: line,
    linea: line,
    lineaNorm: normalizeLineCode(line),
    isGerbidoLine: checkGerbidoLine(line),
    n: shiftNumber || '-',
    c: fallbackDay?.c || 'MAN',
    i: first.start.replace(':', ''),
    li: first.loc_s,
    di: first.dir || '',
    e: last.end.replace(':', ''),
    le: last.loc_e,
    de: last.dir || '',
    d: '',
    communicated: true,
    manualSegments: segments,
  };
}

function normalizeDirectionWord(value = '') {
  const text = String(value || '').trim().toUpperCase();
  if (/^(A|AND|ANDATA)$/.test(text)) return 'A';
  if (/^(R|RIT|RITORNO)$/.test(text)) return 'R';
  return '';
}

function parseTerseTurn(text, date, fallbackDay = null, service = '', weekday = '') {
  const body = String(text || '').toUpperCase();
  const turnLine = body.match(/\bT?\s*(\d{1,3})\s*\/\s*([A-Z0-9()]{1,4})\b/);
  if (!turnLine) return null;

  const first = turnLine[1];
  const second = turnLine[2];
  const firstNumber = Number.parseInt(first, 10);
  const secondNumber = Number.parseInt(second, 10);
  const firstLooksLikeShift = firstNumber >= 100 && (!Number.isNaN(secondNumber) && secondNumber < 100);
  const line = firstLooksLikeShift ? second : first;
  const shiftNumber = firstLooksLikeShift ? first : second;
  const lineNorm = normalizeLineCode(line);
  if (!lineNorm || !shiftNumber) return null;

  const timeBody = body.slice(0, turnLine.index) + body.slice(turnLine.index + turnLine[0].length);
  const timeMatches = [...timeBody.matchAll(/\b(?:(\d{1,2})[:.](\d{2})|(\d{4}))\s*([A-ZÀ-Ù]{1,12})?/g)]
    .map((match) => {
      const compact = match[3] || `${match[1].padStart(2, '0')}${match[2]}`;
      return {
        time: `${compact.slice(0, 2)}:${compact.slice(2)}`,
        direction: normalizeDirectionWord(match[4]),
      };
    })
    .filter((item) => item.direction || item.time);

  if (timeMatches.length < 2) return null;
  const firstTime = timeMatches[0];
  const lastTime = timeMatches[timeMatches.length - 1];
  const startDirection = firstTime.direction || '';
  const endDirection = lastTime.direction || '';
  const segment = {
    ln: line,
    lineaNorm: lineNorm,
    vett: shiftNumber,
    turnoVettura: shiftNumber,
    start: firstTime.time,
    loc_s: startDirection === 'A' ? 'AND' : startDirection === 'R' ? 'RIT' : '-',
    dir: startDirection,
    end: lastTime.time,
    loc_e: endDirection === 'A' ? 'AND' : endDirection === 'R' ? 'RIT' : '-',
    gt: service,
    ver: '',
    run_id: 1,
    source: 'manual-terse',
  };

  return {
    iso: toIso(date),
    date,
    g: weekday || fallbackDay?.g || getWeekdayCode(date),
    t: 'turno',
    l: line,
    linea: line,
    lineaNorm: lineNorm,
    isGerbidoLine: checkGerbidoLine(line),
    n: shiftNumber,
    c: fallbackDay?.c || 'MAN',
    i: firstTime.time.replace(':', ''),
    li: segment.loc_s,
    di: startDirection,
    e: lastTime.time.replace(':', ''),
    le: segment.loc_e,
    de: endDirection,
    d: '',
    communicated: true,
    manualSegments: [segment],
  };
}

export function parseCommunicatedShift(text, fallbackDate = null, fallbackDay = null) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const normalized = raw.replace(/\r/g, '\n');
  const hasDateInText = Boolean(
    normalized.match(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/) ||
      normalized.match(/\b\d{1,2}\s+(gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|set|ottobre|ott|novembre|nov|dicembre|dic)(?:\s+\d{2,4})?\b/i) ||
      normalized.match(/\b(oggi|domani|dopodomani|ieri)\b/i),
  );
  const date = findFlexibleDate(normalized, fallbackDate);
  if (!date || Number.isNaN(date.getTime())) return null;
  const service = getCommunicatedService(normalized, date);
  const weekday = hasDateInText ? getWeekdayCode(date) : fallbackDay?.g || getWeekdayCode(date);
  const body = stripDateWords(normalized);

  const tokens = body
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/, ' ')
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase().replace(/[,:;]+$/g, ''))
    .filter(Boolean);

  const geIndex = tokens.findIndex((token) => token === 'GE');
  if (geIndex < 3) {
    return parseTerseTurn(body, date, fallbackDay, service, weekday) || parseManualDevelopment(body, date, fallbackDay, service, weekday);
  }

  const line = tokens[geIndex - 2];
  const number = tokens[geIndex - 1];
  const code = tokens[geIndex - 3] || '';
  const after = tokens.slice(geIndex + 1);
  const times = [];
  const places = [];
  const directions = [];

  after.forEach((token) => {
    const clock = compactToClock(token);
    if (clock) {
      times.push(clock.replace(':', ''));
    } else if (/^[A-Z]{2,4}$/.test(token)) {
      places.push(token);
      directions.push('');
    } else if (/^[AR]$/.test(token) && directions.length > 0) {
      directions[directions.length - 1] = token;
    }
  });

  if (!line || !number || !times[0] || !places[0] || !times[1] || !places[1]) {
    return parseTerseTurn(body, date, fallbackDay, service, weekday) || parseManualDevelopment(body, date, fallbackDay, service, weekday);
  }

  return {
    iso: toIso(date),
    date,
    g: weekday,
    t: 'turno',
    l: line,
    linea: line,
    lineaNorm: normalizeLineCode(line),
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
    communicated: true,
    gt: service,
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

  collectShiftRows(lines).forEach(({ dateString, weekday, rest: restRaw }) => {
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
