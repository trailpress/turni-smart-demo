export const GERBIDO_LINES = [
  '2',
  '5',
  '5B',
  '10',
  '12',
  '14',
  '17',
  '17B',
  '33',
  '34',
  '35',
  '36',
  '36_MERC',
  '38',
  '39',
  '43',
  '44',
  '55',
  '58',
  '58B',
  '62',
  '63',
  '63B',
  '71',
  '74',
  '76',
  '132',
  'CP1',
  'M1N',
  'M1S',
];

const DISPLAY_NAMES = {
  '36_MERC': '36 (merc.)',
};

export function normalizeLineCode(line) {
  const raw = String(line ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\\]/g, '/')
    .replace(/\s+/g, ' ');

  if (!raw) return '';
  if (/^36\s*(?:\(|)?MERC\.?(?:\)|)?$/.test(raw)) return '36_MERC';

  const compact = raw.replace(/\s+/g, '').replace(/[()]/g, '');
  if (['CP1', 'M1N', 'M1S'].includes(compact)) return compact;

  const barrato = compact.replace(/\/+$/g, 'B');
  const match = barrato.match(/^0*(\d+)([A-Z]*)$/);
  if (!match) return barrato;

  const number = String(Number.parseInt(match[1], 10));
  return `${number}${match[2] || ''}`;
}

export function isGerbidoLine(line) {
  return GERBIDO_LINES.includes(normalizeLineCode(line));
}

export function getLineDisplayName(line) {
  const normalized = normalizeLineCode(line);
  return DISPLAY_NAMES[normalized] || normalized || String(line ?? '');
}

export function getLineVariant(line) {
  const normalized = normalizeLineCode(line);
  if (normalized === '36_MERC') return 'merc';
  if (/B$/.test(normalized)) return 'B';
  if (['CP1', 'M1N', 'M1S'].includes(normalized)) return 'speciale';
  return 'base';
}

