import { SPECIAL_CODES } from './parserPreconoscenza.js';
import { formatCompactTime } from './parserPreconoscenza.js';
import { BALLOTTAGGI } from './constants/shiftClassification.js';

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(entries = []) {
  const rows = [
    ['Data', 'Tipo', 'Linea', 'Turno', 'Inizio', 'Fine', 'Partenza', 'Termine', 'Note'],
    ...entries.map((day) => {
      if (day?.t !== 'turno') {
        const info = SPECIAL_CODES[day?.t] || { label: day?.t || '', description: '' };
        const ballot = day?.ball ? `${day.ball} ${BALLOTTAGGI[day.ball]?.description || ''}` : '';
        return [day?.iso || '', info.label, '', '', '', '', '', '', ballot || info.description || day?.x || ''];
      }

      return [
        day.iso || '',
        'Turno',
        day.l || '',
        day.n || '',
        formatCompactTime(day.i),
        formatCompactTime(day.e),
        day.li || '',
        day.le || '',
        day.c || '',
      ];
    }),
  ];

  return rows.map((row) => row.map(escapeCsv).join(';')).join('\n');
}

export function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
