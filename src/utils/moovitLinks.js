import { CHANGE_POINTS, getChangePointLabel, normalizeChangePoint } from '../constants/changePoints.js';

const MOOVIT_METRO_ID_TORINO = '222';
const PARTNER_ID = 'turni_smart';

function encode(value) {
  return encodeURIComponent(String(value || '').trim());
}

function normalizeTime(value = '') {
  const match = String(value).match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function buildDateParam(dayData, startTime) {
  if (!dayData?.iso || !startTime) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date(`${dayData.iso}T00:00:00`);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function buildMoovitTarget(shift, dayData) {
  if (!shift || shift.type === 'special') return null;

  const placeCode = normalizeChangePoint(shift.startPlace || dayData?.li || '');
  const changePoint = CHANGE_POINTS[placeCode] || null;
  const placeLabel = getChangePointLabel(placeCode) || `${placeCode || 'posto cambio'} Torino`;
  const startTime = normalizeTime(shift.start || dayData?.i);
  const line = String(shift.line || dayData?.l || '').trim();
  const destinationName = [`Linea ${line}`, placeLabel, startTime ? `ore ${startTime}` : ''].filter(Boolean).join(' · ');
  const dateParam = buildDateParam(dayData, startTime);
  const dateQuery = dateParam ? `&date=${encode(dateParam)}` : '';
  const coordinateQuery =
    Number.isFinite(changePoint?.lat) && Number.isFinite(changePoint?.lon) ? `&tll=${changePoint.lat}_${changePoint.lon}` : '';
  const searchTarget = changePoint?.query || destinationName;
  const webUrl =
    changePoint?.moovitUrl ||
    `https://moovit.com/?metroId=${MOOVIT_METRO_ID_TORINO}&lang=it&to=${encode(searchTarget)}${coordinateQuery}${dateQuery}`;
  const appUrl =
    Number.isFinite(changePoint?.lat) && Number.isFinite(changePoint?.lon)
      ? `moovit://nearby?lat=${changePoint.lat}&lon=${changePoint.lon}&partner_id=${PARTNER_ID}`
      : '';

  return {
    label: `${placeCode || placeLabel}${startTime ? ` ${startTime}` : ''}`,
    appUrl,
    webUrl,
  };
}

export function openMoovitTarget(target) {
  if (!target?.webUrl) return;

  if (!target.appUrl) {
    window.location.href = target.webUrl;
    return;
  }

  let appOpened = false;
  const markAppOpened = () => {
    appOpened = true;
  };

  window.addEventListener('pagehide', markAppOpened, { once: true });
  window.addEventListener('blur', markAppOpened, { once: true });
  document.addEventListener('visibilitychange', markAppOpened, { once: true });

  window.location.href = target.appUrl;

  window.setTimeout(() => {
    window.removeEventListener('pagehide', markAppOpened);
    window.removeEventListener('blur', markAppOpened);
    document.removeEventListener('visibilitychange', markAppOpened);
    if (!appOpened && !document.hidden) {
      window.location.href = target.webUrl;
    }
  }, 1200);
}
