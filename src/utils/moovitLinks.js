const MOOVIT_METRO_ID_TORINO = '222';
const PARTNER_ID = 'turni_smart';

const PLACE_LABELS = {
  CATT: 'Cattaneo Torino',
  CLMA: 'Claudio Massaia Torino',
  FILA: 'Filadelfia Torino',
  GERB: 'Deposito Gerbido GTT Torino',
  LING: 'Lingotto Torino',
  ORSA: 'Orbassano Torino',
  ORSN: 'Orbassano Torino',
  PITA: 'Piazza Pitagora Torino',
};

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

  const placeCode = String(shift.startPlace || dayData?.li || '').trim().toUpperCase();
  const placeLabel = PLACE_LABELS[placeCode] || `${placeCode || 'posto cambio'} Torino`;
  const startTime = normalizeTime(shift.start || dayData?.i);
  const line = String(shift.line || dayData?.l || '').trim();
  const destinationName = [`Linea ${line}`, placeLabel, startTime ? `ore ${startTime}` : ''].filter(Boolean).join(' · ');
  const dateParam = buildDateParam(dayData, startTime);
  const dateQuery = dateParam ? `&date=${encode(dateParam)}` : '';

  return {
    label: `${placeCode || placeLabel}${startTime ? ` ${startTime}` : ''}`,
    appUrl: `moovit://directions?dest_name=${encode(destinationName)}&auto_run=false${dateQuery}&partner_id=${PARTNER_ID}`,
    webUrl: `https://moovit.com/?metroId=${MOOVIT_METRO_ID_TORINO}&lang=it&to=${encode(destinationName)}${dateQuery}`,
  };
}

export function openMoovitTarget(target) {
  if (!target?.appUrl || !target?.webUrl) return;

  let didLeavePage = false;
  const markLeave = () => {
    didLeavePage = true;
  };
  window.addEventListener('pagehide', markLeave, { once: true });
  window.addEventListener('blur', markLeave, { once: true });

  window.location.href = target.appUrl;
  window.setTimeout(() => {
    window.removeEventListener('pagehide', markLeave);
    window.removeEventListener('blur', markLeave);
    if (!didLeavePage && !document.hidden) {
      window.open(target.webUrl, '_blank', 'noopener,noreferrer');
    }
  }, 900);
}
