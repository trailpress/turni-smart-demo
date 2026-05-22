import { useMemo, useState } from 'react';
import { getLineDisplayName } from '../constants/depotGerbido.js';
import { timeToMinutes } from '../utils/timeUtils.js';
import { Icon } from './Icon.jsx';

const DIRECTION_LABELS = {
  A: 'Andata',
  R: 'Ritorno',
  '-': '',
};

const SERVICE_FILTERS = [
  ['all', 'Tutti'],
  ['feriali', 'Feriali'],
  ['sabato', 'Sabato'],
  ['festivi', 'Festivi'],
];

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

function getServiceType(value = '') {
  const service = String(value || '').toUpperCase();
  if (service.includes('SAB')) return 'sabato';
  if (service.includes('FEST') || service.includes('DOM')) return 'festivi';
  if (
    service.includes('LUN') ||
    service.includes('VEN') ||
    service.includes('FERIALE') ||
    service.includes('FERIALI')
  ) {
    return 'feriali';
  }
  return 'feriali';
}

function getServiceLabel(value = '') {
  const type = getServiceType(value);
  if (type === 'sabato') return 'Sabato';
  if (type === 'festivi') return 'Festivi';
  return 'Feriali';
}

function getServiceKey(segment = {}) {
  const service = getServiceType(segment.gt);
  const gt = String(segment.gt || service).trim().toUpperCase();
  const version = String(segment.ver || '').trim().toUpperCase();
  return `${service}|${gt}|${version}`;
}

function getSegmentIdentity(segment = {}) {
  return [
    segment.ln,
    segment.vett,
    segment.start,
    segment.loc_s,
    segment.dir,
    segment.end,
    segment.loc_e,
    segment.gt,
    segment.ver,
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .join('|');
}

function uniqueSegments(segments = []) {
  const seen = new Set();
  return segments.filter((segment) => {
    const key = getSegmentIdentity(segment);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortSegmentsByDuty(segments = []) {
  return segments
    .slice()
    .map((segment, index) => {
      let start = timeToMinutes(segment.start || '00:00');
      let end = timeToMinutes(segment.end || '00:00');
      if (end < start) end += 1440;
      return { segment, index, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index)
    .map((item) => item.segment);
}

function buildLineIndex(developments = {}) {
  const byLine = new Map();

  Object.entries(developments).forEach(([key, segments]) => {
    if (!Array.isArray(segments) || !segments.length) return;
    const parts = getShiftParts(key);
    const line = segments[0]?.lineaNorm || parts.line;
    if (!line || !parts.shift) return;

    const current = byLine.get(line) || [];
    const groupedByService = segments.reduce((groups, segment) => {
      const serviceKey = getServiceKey(segment);
      groups[serviceKey] = groups[serviceKey] || [];
      groups[serviceKey].push(segment);
      return groups;
    }, {});

    Object.entries(groupedByService).forEach(([serviceKey, serviceSegments]) => {
      const fullSegments = sortSegmentsByDuty(uniqueSegments(serviceSegments));
      const first = fullSegments[0] || {};
      current.push({
        key: `${key}|${serviceKey}`,
        sourceKey: key,
        line,
        shift: parts.shift,
        service: getServiceType(first.gt),
        serviceLabel: getServiceLabel(first.gt),
        gt: first.gt || '',
        ver: first.ver || '',
        segments: fullSegments,
      });
    });
    byLine.set(line, current);
  });

  return Array.from(byLine.entries())
    .map(([line, shifts]) => ({
      line,
      label: getLineDisplayName(line),
      shifts: shifts.sort((a, b) => sortNumericText(a.shift, b.shift) || a.serviceLabel.localeCompare(b.serviceLabel, 'it')),
    }))
    .sort((a, b) => sortNumericText(a.line, b.line));
}

export function LineConsultation({ developments = {} }) {
  const lines = useMemo(() => buildLineIndex(developments), [developments]);
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedShiftKey, setSelectedShiftKey] = useState('');
  const [selectedService, setSelectedService] = useState('all');

  if (!lines.length) return null;

  const activeLine = lines.find((item) => item.line === selectedLine) || lines[0];
  const serviceCounts = activeLine.shifts.reduce(
    (counts, item) => ({
      ...counts,
      [item.service]: (counts[item.service] || 0) + 1,
    }),
    { all: activeLine.shifts.length },
  );
  const visibleShifts = activeLine.shifts.filter((item) => selectedService === 'all' || item.service === selectedService);
  const activeShift = visibleShifts.find((item) => item.key === selectedShiftKey) || visibleShifts[0];

  function handleLineSelect(line) {
    const nextLine = lines.find((item) => item.line === line) || lines[0];
    const nextShifts = nextLine?.shifts.filter((item) => selectedService === 'all' || item.service === selectedService) || [];
    setSelectedLine(line);
    setSelectedShiftKey((nextShifts[0] || nextLine?.shifts[0])?.key || '');
  }

  function handleServiceChange(service) {
    const nextShifts = activeLine.shifts.filter((item) => service === 'all' || item.service === service);
    setSelectedService(service);
    setSelectedShiftKey(nextShifts[0]?.key || '');
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

      <div className="line-grid" aria-label="Linee disponibili">
        {lines.map((item) => (
          <button
            className={item.line === activeLine.line ? 'line-grid-button is-active' : 'line-grid-button'}
            key={item.line}
            onClick={() => handleLineSelect(item.line)}
            type="button"
          >
            <strong>{item.line}</strong>
            <span>{item.shifts.length}</span>
          </button>
        ))}
      </div>

      <div className="line-drilldown" key={activeLine.line}>
        <div className="line-drilldown__bar">
          <div>
            <span>Linea selezionata</span>
            <strong>{activeLine.label}</strong>
          </div>
          <div className="line-service-filter" aria-label="Tipo giornata">
            {SERVICE_FILTERS.map(([key, label]) => (
              <button
                className={selectedService === key ? 'line-service-chip is-active' : 'line-service-chip'}
                disabled={!serviceCounts[key]}
                key={key}
                onClick={() => handleServiceChange(key)}
                type="button"
              >
                <span>{label}</span>
                <small>{serviceCounts[key] || 0}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="line-consultation__content">
          <div className="line-shift-list" key={`${activeLine.line}-${selectedService}`} aria-label={`Turni ${activeLine.label}`}>
            {visibleShifts.map((item) => (
              <button
                className={item.key === activeShift?.key ? 'line-shift-button is-active' : 'line-shift-button'}
                key={item.key}
                onClick={() => setSelectedShiftKey(item.key)}
                type="button"
              >
                <strong>Turno {item.shift}</strong>
                <span>{item.serviceLabel} · {item.segments.length} seg.</span>
              </button>
            ))}
          </div>

          {activeShift ? (
          <article className="line-development-card" key={activeShift.key}>
            <div className="line-development-card__title">
              <span>{activeLine.label} · {activeShift.serviceLabel}</span>
              <h3>Turno {activeShift.shift}</h3>
            </div>
            <div className="line-development-steps">
              {activeShift.segments.map((segment, index) => (
                <div className="line-development-step" key={`${segment.start}-${segment.end}-${index}`} style={{ '--step-index': index }}>
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
          ) : (
            <article className="line-development-card line-development-card--empty">
              <div className="line-development-card__title">
                <span>{activeLine.label}</span>
                <h3>Nessun turno per questo filtro</h3>
              </div>
              <p className="muted-text">Scegli un altro tipo giornata per consultare gli sviluppi disponibili.</p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
