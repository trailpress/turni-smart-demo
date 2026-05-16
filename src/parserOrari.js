import { timeToMinutes } from './utils/timeUtils.js';
import { normalizeLineCode } from './constants/depotGerbido.js';

const SEGMENT_RE =
  /(?:([A-Z0-9/() ]{1,12}\s+\d{1,3})\s+)?([A-Z0-9/() ]{1,12})\s*\/\s*(\d+)\s+(\d{2}[.:]\d{2})\s+([A-Z]{2,4})\s+([AR-])\s+(\d{2}[.:]\d{2})\s+([A-Z]{2,4})/g;

function normalizeTime(value) {
  return value.replace('.', ':');
}

function normalizeLine(line, { pad = true } = {}) {
  const raw = normalizeLineCode(line);
  const number = Number.parseInt(raw, 10);
  const suffix = raw.replace(/^\d+/, '');
  if (Number.isNaN(number)) return raw;
  return `${pad ? String(number).padStart(2, '0') : String(number)}${suffix}`;
}

export function normalizeShiftKey(line, shiftNumber, { padLine = true } = {}) {
  const normalizedLine = normalizeLine(line, { pad: padLine });
  const rawShift = String(shiftNumber || '').trim();
  const parsedShift = Number.parseInt(rawShift, 10);
  const normalizedShift = Number.isNaN(parsedShift) ? rawShift.replace(/\s+/g, '') : String(parsedShift);
  if (!normalizedLine || !normalizedShift) return '';
  return `${normalizedLine} ${normalizedShift}`.replace(/\s+/g, ' ').trim();
}

function normalizeCode(code) {
  const parts = String(code || '').trim().split(/\s+/);
  if (parts.length !== 2) return code;
  return normalizeShiftKey(parts[0], parts[1]);
}

function gapMinutes(end, start) {
  const gap = timeToMinutes(start) - timeToMinutes(end);
  return gap < 0 ? gap + 1440 : gap;
}

function detectGt(text, previousGt = '') {
  const versionMatch = text.match(/gruppo\s+\S+\s*-\s*(.+?)\s*-\s*Versione\s+(\w+)/i);
  if (versionMatch) return { gt: versionMatch[1].trim(), ver: versionMatch[2].trim() };

  const header = text.slice(0, 1000).toUpperCase();
  let gt = '';
  if (header.includes('FESTIVO')) gt = 'FESTIVO';
  else if (header.includes('SABATO')) gt = 'SABATO';
  else if (header.includes('LUN') && header.includes('VEN')) gt = 'LUN - VEN';

  return { gt: gt || previousGt, ver: '' };
}

function addSegment(developments, code, segment) {
  developments[code] = developments[code] || [];
  const exists = developments[code].some(
    (existing) =>
      existing.start === segment.start &&
      existing.end === segment.end &&
      existing.loc_s === segment.loc_s &&
      existing.loc_e === segment.loc_e &&
      existing.gt === segment.gt &&
      existing.ln === segment.ln,
  );
  if (!exists) developments[code].push(segment);
}

export function parseOrariPageLines(text, gt, ver, developments) {
  const pageSegments = [];

  String(text || '')
    .split('\n')
    .forEach((line) => {
      SEGMENT_RE.lastIndex = 0;
      let match;
      while ((match = SEGMENT_RE.exec(line)) !== null) {
        const code = match[1] ? normalizeCode(match[1]) : null;
        pageSegments.push({
          code,
          done: false,
          segment: {
            ln: match[2],
            lineaNorm: normalizeLineCode(match[2]),
            vett: match[3],
            turnoVettura: code || '',
            start: normalizeTime(match[4]),
            loc_s: match[5],
            dir: match[6] !== '-' ? match[6] : '',
            end: normalizeTime(match[7]),
            loc_e: match[8],
            gt,
            ver,
          },
        });
      }
    });

  const codeEnds = {};
  const runCounters = {};
  let lastExplicitCode = null;

  pageSegments.forEach((item) => {
    if (item.code) {
      const code = normalizeCode(item.code);
      const shiftNumber = Number.parseInt(code.split(' ')[1] || '999', 10);
      const isSplitCandidate = shiftNumber < 100;
      const previous = codeEnds[code];
      const canContinue = previous ? gapMinutes(previous.end, item.segment.start) <= 480 : false;

      if (isSplitCandidate && previous && canContinue) {
        item.segment.run_id = previous.run_id;
      } else {
        runCounters[code] = (runCounters[code] || 0) + 1;
        item.segment.run_id = runCounters[code];
      }

      item.done = true;
      item.segment.turnoVettura = code;
      addSegment(developments, code, item.segment);
      codeEnds[code] = { end: item.segment.end, loc: item.segment.loc_e, run_id: item.segment.run_id };
      lastExplicitCode = code;
      return;
    }

    if (!lastExplicitCode) return;

    const shiftNumber = Number.parseInt(lastExplicitCode.split(' ')[1] || '999', 10);
    const isSplitCandidate = shiftNumber < 100;
    const previous = codeEnds[lastExplicitCode];
    if (!isSplitCandidate || !previous || !item.segment.start) return;

    const gap = gapMinutes(previous.end, item.segment.start);
    const canAttach = (gap >= 0 && gap <= 240) || (gap <= 480 && previous.loc === item.segment.loc_s);
    if (!canAttach) return;

    item.segment.run_id = previous.run_id;
    item.segment.turnoVettura = lastExplicitCode;
    item.done = true;
    addSegment(developments, lastExplicitCode, item.segment);
    codeEnds[lastExplicitCode] = { end: item.segment.end, loc: item.segment.loc_e, run_id: item.segment.run_id };
  });

  let changed = true;
  let maxIterations = 15;
  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations -= 1;

    pageSegments.forEach((item) => {
      if (item.done) return;

      const bestCode =
        Object.keys(codeEnds).find((code) => codeEnds[code].end === item.segment.start && codeEnds[code].loc === item.segment.loc_s) ||
        Object.keys(codeEnds).find((code) => codeEnds[code].end === item.segment.start);

      if (!bestCode) return;

      const shiftNumber = Number.parseInt(bestCode.split(' ')[1] || '999', 10);
      if (shiftNumber < 100 && developments[bestCode]?.length >= 2) return;

      item.done = true;
      changed = true;
      item.segment.run_id = codeEnds[bestCode].run_id;
      item.segment.turnoVettura = bestCode;
      addSegment(developments, bestCode, item.segment);
      codeEnds[bestCode] = { end: item.segment.end, loc: item.segment.loc_e, run_id: item.segment.run_id };
    });
  }
}

export function parseOrari(pagesText) {
  const pages = Array.isArray(pagesText) ? pagesText : [pagesText];
  const developments = {};
  let lastGt = '';

  pages.forEach((pageText) => {
    const { gt, ver } = detectGt(pageText, lastGt);
    if (gt) lastGt = gt;
    if (!gt) return;
    parseOrariPageLines(pageText, gt, ver, developments);
  });

  return developments;
}

export function buildDevKeyVariants(line, shiftNumber) {
  const rawLine = normalizeLineCode(line);
  const number = Number.parseInt(rawLine, 10);
  const suffix = rawLine.replace(/^\d+/, '');
  const normalizedShift = String(Number.parseInt(shiftNumber, 10));
  if (!rawLine || normalizedShift === 'NaN') return [];

  const lines = Number.isNaN(number)
    ? [rawLine]
    : [
        `${String(number).padStart(2, '0')}${suffix}`,
        `${number}${suffix}`,
        rawLine,
        String(number).padStart(2, '0'),
        String(number),
      ];

  return [...new Set(lines)]
    .flatMap((item) => [normalizeShiftKey(item, shiftNumber), normalizeShiftKey(item, shiftNumber, { padLine: false })])
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function matchesServiceDay(segmentGt, date) {
  if (!date || !segmentGt) return true;
  const gt = segmentGt.toUpperCase();
  const day = date.getDay();

  if (day === 6) return gt.includes('SAB');
  if (day === 0) return gt.includes('FEST') || gt.includes('DOM');

  return (
    gt.includes('LUN') ||
    gt.includes('MAR') ||
    gt.includes('MER') ||
    gt.includes('GIO') ||
    gt.includes('VEN') ||
    gt.includes('FERIALE') ||
    gt.includes('FERIALI')
  );
}

function pickRun(segments, preShift) {
  const runs = segments.reduce((acc, segment) => {
    const key = segment.run_id === undefined ? '_' : String(segment.run_id);
    acc[key] = acc[key] || [];
    acc[key].push(segment);
    return acc;
  }, {});
  const runKeys = Object.keys(runs);

  if (runKeys.length <= 1) return runs[runKeys[0]] || segments;
  if (!preShift?.i) return runs[runKeys[0]];

  const preStart = timeToMinutes(`${preShift.i.slice(0, 2)}:${preShift.i.slice(2)}`);
  const bestKey = runKeys
    .map((key) => ({
      key,
      diff: Math.abs(timeToMinutes(runs[key].slice().sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))[0].start) - preStart),
    }))
    .sort((a, b) => a.diff - b.diff)[0].key;

  return runs[bestKey];
}

function compactTime(value) {
  const raw = String(value || '').replace(/\D/g, '');
  if (raw.length !== 4) return '';
  return `${raw.slice(0, 2)}:${raw.slice(2)}`;
}

function normalizePlace(value) {
  return String(value || '').trim().toUpperCase();
}

function scoreFallbackSegments(key, segments, line, shiftNumber, date, preShift) {
  if (!segments?.length) return 0;

  const candidates = segments.filter((segment) => matchesServiceDay(segment.gt, date));
  const list = candidates.length ? candidates : segments;
  const sorted = list.slice().sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lineNorm = normalizeLineCode(line);
  const startTime = compactTime(preShift?.i);
  const endTime = compactTime(preShift?.e);
  const startPlace = normalizePlace(preShift?.li);
  const endPlace = normalizePlace(preShift?.le);
  const normalizedShift = String(Number.parseInt(shiftNumber, 10));
  let score = 0;

  if (list.some((segment) => segment.lineaNorm === lineNorm || normalizeLineCode(segment.ln) === lineNorm)) score += 4;
  if (normalizedShift !== 'NaN' && String(key).split(' ')[1] === normalizedShift) score += 5;
  if (first?.start === startTime) score += 3;
  if (last?.end === endTime) score += 3;
  if (normalizePlace(first?.loc_s) === startPlace) score += 2;
  if (normalizePlace(last?.loc_e) === endPlace) score += 2;

  return score;
}

function findFallbackSegments(developments, line, shiftNumber, date, preShift) {
  if (!preShift) return [];

  const best = Object.entries(developments || {})
    .map(([key, segments]) => ({
      key,
      segments,
      score: scoreFallbackSegments(key, segments, line, shiftNumber, date, preShift),
    }))
    .filter((item) => item.score >= 7)
    .sort((a, b) => b.score - a.score || a.segments.length - b.segments.length)[0];

  if (!best) return [];
  const filtered = best.segments.filter((segment) => matchesServiceDay(segment.gt, date));
  return filtered.length ? filtered : best.segments;
}

export function getDevSegments(developments, line, shiftNumber, date, preShift = null) {
  const keys = buildDevKeyVariants(line, shiftNumber);
  const matchedKey = keys.find((key) => developments?.[key]?.length);
  const allSegments = matchedKey ? developments[matchedKey] : findFallbackSegments(developments, line, shiftNumber, date, preShift);
  if (!allSegments.length) return [];

  const filtered = allSegments.filter((segment) => matchesServiceDay(segment.gt, date));
  const candidates = filtered.length ? filtered : allSegments;
  return pickRun(candidates, preShift).slice().sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

export function summarizeDevelopments(developments) {
  const keys = Object.keys(developments || {});
  return {
    totalTurns: keys.length,
    splitTurns: keys.filter((key) => {
      const runs = (developments[key] || []).reduce((acc, segment) => {
        const run = segment.run_id === undefined ? '_' : String(segment.run_id);
        acc[run] = (acc[run] || 0) + 1;
        return acc;
      }, {});
      return Object.values(runs).some((count) => count > 1);
    }).length,
  };
}
