export const SHIFT_CATEGORIES = {
  SPLIT_ODD: {
    type: 'split_odd',
    label: '2 riprese dispari',
    badge: '2 riprese',
    isSplit: true,
    isEvening: false,
    color: '#e65100',
  },
  SPLIT_CHANGE: {
    type: 'split_change',
    label: '2 riprese cambio',
    badge: '2 riprese',
    isSplit: true,
    isEvening: false,
    color: '#d35400',
  },
  MORNING: {
    type: 'morning',
    label: 'Ripresa unica mattino',
    badge: 'Mattino',
    isSplit: false,
    isEvening: false,
    color: '#1b7a3d',
  },
  INTERMEDIATE: {
    type: 'intermediate',
    label: 'Ripresa unica intermedia',
    badge: 'Intermedia',
    isSplit: false,
    isEvening: false,
    color: '#00796b',
  },
  AFTERNOON: {
    type: 'afternoon',
    label: 'Ripresa unica pomeridiana',
    badge: 'Pomeridiano',
    isSplit: false,
    isEvening: false,
    color: '#003366',
  },
  EVENING: {
    type: 'evening',
    label: 'Ripresa unica serale',
    badge: 'Serale',
    isSplit: false,
    isEvening: true,
    color: '#4a148c',
  },
  UNKNOWN: {
    type: 'unknown',
    label: 'Categoria non riconosciuta',
    badge: 'Turno',
    isSplit: false,
    isEvening: false,
    color: '#5a6b80',
  },
};

export const BALLOTTAGGI = {
  B00: {
    label: 'Tutte le tipologie di turno',
    description: '001-099 / 100 / 200 / 300 / 400',
  },
  B01: {
    label: 'Ripresa unica dopo le 11.45',
    description: 'Turni a ripresa unica che inizino dopo le 11.45: codici 300/400',
  },
  B03: {
    label: 'Termine entro le 21.00',
    description: 'Turni che terminano entro le 21: 001-099 / 100 / 200 / 300',
  },
  B04: {
    label: 'Termine entro le 17.45',
    description: 'Turni che terminano entro le 17.45: 001-049 / 100 / 200',
  },
  B05: {
    label: 'Mattino entro le 13.45',
    description: 'Turni a ripresa unica che terminano entro le 13.45: 100',
  },
};

function turnNumber(turnCode) {
  const match = String(turnCode || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function getShiftCategory(turnCode) {
  const code = turnNumber(turnCode);
  if (code === null) return SHIFT_CATEGORIES.UNKNOWN;
  if (code >= 1 && code <= 49) return SHIFT_CATEGORIES.SPLIT_ODD;
  if (code >= 50 && code <= 99) return SHIFT_CATEGORIES.SPLIT_CHANGE;
  if (code >= 100 && code < 200) return SHIFT_CATEGORIES.MORNING;
  if (code >= 200 && code < 300) return SHIFT_CATEGORIES.INTERMEDIATE;
  if (code >= 300 && code < 400) return SHIFT_CATEGORIES.AFTERNOON;
  if (code >= 400 && code < 500) return SHIFT_CATEGORIES.EVENING;
  return SHIFT_CATEGORIES.UNKNOWN;
}

export function isEveningShift(turnCode, fallback = false) {
  const category = getShiftCategory(turnCode);
  return category.type === 'unknown' ? fallback : category.isEvening;
}

export function isSplitCategory(turnCode) {
  return getShiftCategory(turnCode).isSplit;
}

export function getShiftColor(turnCode) {
  return getShiftCategory(turnCode).color;
}
