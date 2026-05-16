import { SPECIAL_CODES } from './parserPreconoscenza.js';
import { getDevSegments } from './parserOrari.js';
import { getLineDisplayName } from './constants/depotGerbido.js';
import { getShiftCategory } from './constants/shiftClassification.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

function compactToTime(value) {
  if (!value) return '00:00';
  return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateOnly(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function dateTime(date, time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return `${dateOnly(date)}T${pad(hours)}${pad(minutes)}00`;
}

function stamp(date = new Date()) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes(),
  )}${pad(date.getUTCSeconds())}Z`;
}

function escapeICS(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function eventBlock({ uid, dtStart, dtEnd, summary, description, allDay = false }) {
  const startKey = allDay ? 'DTSTART;VALUE=DATE' : 'DTSTART';
  const endKey = allDay ? 'DTEND;VALUE=DATE' : 'DTEND';
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp()}`,
    `${startKey}:${dtStart}`,
    `${endKey}:${dtEnd}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    'END:VEVENT',
  ].join('\r\n');
}

export function buildShiftICS(date, dayData, devSegments = []) {
  if (!dayData) return '';
  const eventDate = dayData.date || date;
  const iso = dayData.iso || dateOnly(eventDate);

  if (dayData.t !== 'turno') {
    const info = SPECIAL_CODES[dayData.t] || { label: dayData.t, description: '' };
    return eventBlock({
      uid: `turni-smart-${iso}-${dayData.t}@local`,
      dtStart: dateOnly(eventDate),
      dtEnd: dateOnly(addDays(eventDate, 1)),
      summary: info.label,
      description: [info.description, dayData.ball ? `Ballottaggio ${dayData.ball}` : '', dayData.x || ''].filter(Boolean).join('\n'),
      allDay: true,
    });
  }

  const segments = devSegments.length ? devSegments : [];
  const firstStart = segments[0]?.start || compactToTime(dayData.i);
  const lastEnd = segments[segments.length - 1]?.end || compactToTime(dayData.e);
  const start = dateTime(eventDate, firstStart);
  const endDate = lastEnd < firstStart ? addDays(eventDate, 1) : eventDate;
  const end = dateTime(endDate, lastEnd);
  const category = getShiftCategory(dayData.n);
  const line = getLineDisplayName(dayData.lineaNorm || dayData.l);
  const segmentDescription = segments.length
    ? segments
        .map((segment, index) => `${index + 1}. ${segment.start} ${segment.loc_s} ${segment.dir || '-'} ${segment.end} ${segment.loc_e}`)
        .join('\n')
    : `${compactToTime(dayData.i)} ${dayData.li || ''} - ${compactToTime(dayData.e)} ${dayData.le || ''}`;

  return eventBlock({
    uid: `turni-smart-${iso}-${line}-${dayData.n}@local`,
    dtStart: start,
    dtEnd: end,
    summary: `Turno ${line} ${dayData.n}`,
    description: [`Linea ${line}`, `Turno ${dayData.n}`, category.label, segmentDescription].filter(Boolean).join('\n'),
  });
}

export function buildICS(entries, developments = {}) {
  const events = entries
    .filter(Boolean)
    .map((day) => buildShiftICS(day.date, day, day.t === 'turno' ? getDevSegments(developments, day.l, day.n, day.date, day) : []))
    .filter(Boolean);

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Turni Smart//IT', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join(
    '\r\n',
  );
}

export const buildRangeICS = buildICS;

export function buildBallotICS(entries = []) {
  return buildICS(entries.filter((day) => day?.t === 'RIS'), {});
}

export function downloadICS(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function openCalendarICS(icsContent, filename = 'turni-smart.ics') {
  const encoded = encodeURIComponent(icsContent);
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isMacSafari = /Macintosh/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome|CriOS|Edg/.test(userAgent);

  if (isIOS) {
    window.location.href = `data:text/calendar;charset=utf-8,${encoded}`;
    return;
  }

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  if (isMacSafari) {
    window.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function createWebcalDataUrlFallback(content) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

export function getSubscriptionCalendarUrl() {
  return null;
}
