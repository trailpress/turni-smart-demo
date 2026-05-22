import { useMemo, useState } from 'react';
import { getLineDisplayName } from '../constants/depotGerbido.js';
import { Icon } from './Icon.jsx';

const DIRECTION_LABELS = {
  A: 'Andata',
  R: 'Ritorno',
  '-': '',
};

function sortNumericText(a, b) {
  const numberA = Number.parseInt(a, 10);
  const numberB = Number.parseInt(b, 10);
  if (!Number.isNaN(numberA) && !Number.isNaN(numberB) && numberA !== numberB) return numberA - numberB;
  return String(a).localeCompare(String(b), 'it', { numeric: true });
}

function getShiftParts(key = '') {
  const [line = '', shift = ''] = String(key).split(/\s+/);
  return { line, shift };
}

function formatDirection(value = '') {
  return DIRECTION_LABELS[value] || value || '';
}

function formatRoute(segment = {}) {
  const direction = formatDirection(segment.dir);
  return [segment.loc_s, direction, segment.loc_e].filter(Boolean).join(' ');
}

function buildLineIndex(developments = {}) {
  const byLine = new Map();

  Object.entries(developments).forEach(([key, segments]) => {
    if (!Array.isArray(segments) || !segments.length) return;
    const parts = getShiftParts(key);
    const line = segments[0]?.lineaNorm || parts.line;
    if (!line || !parts.shift) return;

    const entry = {
      key,
      line,
      shift: parts.shift,
      segments: [...segments].sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))),
    };

    const current = byLine.get(line) || [];
    current.push(entry);
    byLine.set(line, current);
  });

  return Array.from(byLine.entries())
    .map(([line, shifts]) => ({
      line,
      label: getLineDisplayName(line),
      shifts: shifts.sort((a, b) => sortNumericText(a.shift, b.shift)),
    }))
    .sort((a, b) => sortNumericText(a.line, b.line));
}

export function LineConsultation({ developments = {} }) {
  const lines = useMemo(() => buildLineIndex(developments), [developments]);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedShiftKey, setSelectedShiftKey] = useState('');

  if (!lines.length) return null;

  const activeLine = lines.find((item) => item.line === selectedLine) || lines[0];
  const activeShift = activeLine.shifts.find((item) => item.key === selectedShiftKey) || activeLine.shifts[0];

  function handleLineChange(event) {
    const line = event.target.value;
    const nextLine = lines.find((item) => item.line === line) || lines[0];
    setSelectedLine(line);
    setSelectedShiftKey(nextLine?.shifts[0]?.key || '');
  }

  return (
    <section className="line-consultation dc" aria-labelledby="line-consultation-title">
      <div className="line-consultation__header">
        <div>
          <span className="section-kicker">
            <Icon name="bus" size={18} />
            Orari Linee
          </span>
          <h2 id="line-consultation-title">Consulta linee e turni</h2>
        </div>
        <span>{lines.length} linee disponibili</span>
      </div>

      <div className="line-consultation__controls">
        <label>
          Linea
          <select value={activeLine.line} onChange={handleLineChange}>
            {lines.map((line) => (
              <option key={line.line} value={line.line}>
                {line.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="line-consultation__content">
        <div className="line-shift-list" aria-label={`Turni ${activeLine.label}`}>
          {activeLine.shifts.map((item) => (
            <button
              className={item.key === activeShift.key ? 'line-shift-button is-active' : 'line-shift-button'}
              key={item.key}
              onClick={() => setSelectedShiftKey(item.key)}
              type="button"
            >
              <strong>Turno {item.shift}</strong>
              <span>{item.segments.length} segmenti</span>
            </button>
          ))}
        </div>

        <article className="line-development-card" key={activeShift.key}>
          <div className="line-development-card__title">
            <span>{activeLine.label}</span>
            <h3>Turno {activeShift.shift}</h3>
          </div>
          <div className="line-development-steps">
            {activeShift.segments.map((segment, index) => (
              <div className="line-development-step" key={`${segment.start}-${segment.end}-${index}`}>
                <strong>{index + 1}</strong>
                <div>
                  <span>{segment.start} - {segment.end}</span>
                  <p>{formatRoute(segment)}</p>
                </div>
                <em>Vett. {segment.turnoVettura || segment.vett || '-'}</em>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
