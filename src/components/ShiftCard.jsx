import { useState } from 'react';
import { formatMinutes, minutesBetween } from '../utils/timeUtils.js';
import { getDevSegments } from '../parserOrari.js';
import { getLineDisplayName } from '../constants/depotGerbido.js';
import { BALLOTTAGGI } from '../constants/shiftClassification.js';
import { AssetIcon, Icon } from './Icon.jsx';

const DIRECTION_LABELS = {
  A: 'Andata',
  R: 'Ritorno',
  '-': '-',
};

function getDateParts(label = '') {
  const match = String(label).match(/(?:(Prossimo|Oggi|Domani|Settimana)\s+·\s+)?([a-zà]+)\s+(\d{1,2})\s+([a-zà]+)/i);
  return {
    context: match?.[1] || '',
    weekday: (match?.[2] || '').toUpperCase(),
    day: match?.[3] || '',
    month: (match?.[4] || '').toUpperCase(),
  };
}

function formatDevelopmentLines(segments = []) {
  if (!segments.length) return [];
  return [
    'Sviluppo turno:',
    ...segments.map((segment, index) => {
      const direction = DIRECTION_LABELS[segment.dir] || segment.dir || '-';
      const vehicle = segment.vett ? ` | Vett. ${segment.vett}` : '';
      const vehicleShift = segment.turnoVettura ? ` | Turno vett. ${segment.turnoVettura}` : '';
      return `${index + 1}. ${segment.start} - ${segment.end} | ${segment.loc_s} ${direction} ${segment.loc_e}${vehicle}${vehicleShift}`;
    }),
  ];
}

function buildShareText(shift, segments = [], assignedTurn = '') {
  if (!shift) return '';
  if (shift.type === 'special') {
    return [
      shift.date,
      shift.title,
      shift.ballot ? shift.ballotLabel || 'Turno da assegnare' : shift.description || 'Giornata senza turno',
      shift.note,
      assignedTurn ? `Turno comunicato:\n${assignedTurn}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `${shift.date}`,
    `Linea ${shift.line} - Turno ${shift.number}`,
    `${shift.start} ${shift.startPlace} -> ${shift.end} ${shift.endPlace}`,
    `Cod. ${shift.code}${shift.duration ? ` - Dur. ${shift.duration}` : ''}`,
    ...formatDevelopmentLines(segments),
  ].join('\n');
}

function formatPlaceDirection(place, direction) {
  const normalized = DIRECTION_LABELS[direction] || direction || '';
  if (!normalized || normalized === '-') return place;
  return `${place} ${normalized}`;
}

function formatVehicleShift(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const [, shift] = normalized.split(/\s+/);
  return shift || normalized;
}

function getCategoryIconName(category, shift) {
  const text = `${category?.label || ''} ${category?.badge || ''}`.toLowerCase();
  if (shift?.isShortRest || text.includes('riposo')) return 'rest';
  if (shift?.isSplit || text.includes('riprese') || text.includes('spezz')) return 'route';
  if (shift?.isEvening || text.includes('seral')) return 'stats';
  return 'busMark';
}

export function ShiftCard({ calendarActions, date, developments = {}, enrichment = null, onAssignTurn, shift, dayData }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [assignedTurn, setAssignedTurn] = useState('');
  const [assignedTurnError, setAssignedTurnError] = useState('');
  const [assignedTurnSuccess, setAssignedTurnSuccess] = useState('');
  const [isBallotInfoOpen, setIsBallotInfoOpen] = useState(false);

  if (shift.type === 'special') {
    const isBallot = Boolean(shift.ballot);
    const ballotInfo = shift.ballot ? BALLOTTAGGI[shift.ballot] : null;
    const shareText = buildShareText(shift, [], assignedTurn.trim());
    function confirmAssignedTurn() {
      setAssignedTurnError('');
      setAssignedTurnSuccess('');
      try {
        onAssignTurn?.(dayData, assignedTurn);
        setAssignedTurnSuccess('Turno inserito.');
      } catch (error) {
        setAssignedTurnError(error.message || 'Formato turno non riconosciuto.');
      }
    }

    return (
      <article className="shift-card shift-card--special dc">
        <div className="shift-special-layout">
          <div className="shift-date-tile" aria-label={shift.date}>
            <span>{getDateParts(shift.date).weekday || shift.date}</span>
            {getDateParts(shift.date).day ? <strong>{getDateParts(shift.date).day}</strong> : null}
            {getDateParts(shift.date).month ? <small>{getDateParts(shift.date).month}</small> : null}
          </div>
          <div>
            <p className="shift-date">{shift.date}</p>
            <h3>{shift.title}</h3>
            <div className="shift-special-summary">
              {isBallot ? (
                <>
                  <p>{shift.ballotLabel || 'Turno da assegnare'}</p>
                  <button className="ballot-info-button" onClick={() => setIsBallotInfoOpen(true)} type="button">
                    <Icon name="question" size={17} />
                    Dettagli ballottaggio
                  </button>
                </>
              ) : (
                <span className="shift-meta-chip shift-meta-chip--rest">
                  <AssetIcon name="rest" size={24} />
                  Giornata libera
                </span>
              )}
            </div>
          </div>
          <div className={isBallot ? 'shift-special-icon shift-special-icon--assignment' : 'shift-special-icon'} aria-hidden="true">
            {isBallot ? <Icon name="question" size={62} strokeWidth={2.9} /> : <AssetIcon name="rest" size={88} />}
          </div>
        </div>
        {isBallot ? (
          <div className="ballot-assignment-box">
            <label htmlFor={`ballot-assignment-${shift.date}`}>Turno comunicato</label>
            <textarea
              id={`ballot-assignment-${shift.date}`}
              onChange={(event) => setAssignedTurn(event.target.value)}
              placeholder="Scrivi o incolla qui il turno assegnato con eventuale sviluppo."
              rows={4}
              value={assignedTurn}
            />
            {assignedTurnError ? <p className="ballot-assignment-error">{assignedTurnError}</p> : null}
            {assignedTurnSuccess ? <p className="ballot-assignment-success">{assignedTurnSuccess}</p> : null}
            <button className="ballot-insert-button" disabled={!assignedTurn.trim()} onClick={confirmAssignedTurn} type="button">
              Inserisci turno
            </button>
          </div>
        ) : (
          <p className="shift-special-note">{shift.description || shift.note || 'Giornata senza turno'}</p>
        )}
        {calendarActions ? <CalendarActions actions={calendarActions(dayData, [])} compact shareText={shareText} /> : null}
        {isBallot && isBallotInfoOpen ? (
          <div className="ballot-modal" role="dialog" aria-modal="true" aria-label="Dettagli ballottaggio">
            <div className="ballot-modal__panel">
              <div className="ballot-modal__header">
                <div>
                  <span>{shift.ballot || 'RIS'}</span>
                  <h4>{ballotInfo?.label || shift.ballotLabel || 'Turno da assegnare'}</h4>
                </div>
                <button aria-label="Chiudi dettagli ballottaggio" onClick={() => setIsBallotInfoOpen(false)} type="button">
                  ×
                </button>
              </div>
              <p>{ballotInfo?.description || shift.note || 'Il turno verra comunicato successivamente.'}</p>
              <div className="ballot-modal__legend">
                {Object.entries(BALLOTTAGGI).map(([code, item]) => (
                  <div key={code}>
                    <strong>{code}</strong>
                    <span>{item.label}</span>
                    <small>{item.description}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  const lookupSegments =
    dayData?.t === 'turno' ? getDevSegments(developments, dayData.l, dayData.n, date || dayData.date, dayData) : [];
  const segments = lookupSegments.length ? lookupSegments : shift.segments || [];
  const isSplit = segments.length > 1 || shift.isSplit;
  const isEvening = Boolean(enrichment?.isEvening ?? shift.isEvening);
  const isShortRest = Boolean(enrichment?.isShortRest ?? shift.isShortRest);
  const category = enrichment?.category || shift.category;
  const hasSegments = segments.length > 0;
  const splitPause = segments.length > 1 ? minutesBetween(segments[0].end, segments[1].start) : null;
  const dateParts = getDateParts(shift.date);
  const canFlipDevelopment = isSplit && hasSegments;
  const showEveningBadge = isEvening && category?.badge !== 'Serale';
  const categoryIconName = getCategoryIconName(category, { ...shift, isEvening, isShortRest, isSplit });
  const shareText = buildShareText(shift, segments);

  return (
    <article className={canFlipDevelopment ? 'shift-card shift-card--flip dc' : 'shift-card dc'}>
      <div className={isFlipped ? 'shift-card__flipper is-flipped' : 'shift-card__flipper'}>
        <div className="shift-card__face shift-card__face--front">
          <div className="shift-card__main">
            <div className="shift-date-tile" aria-label={shift.date}>
              {dateParts.context ? <span className="shift-date-context">{dateParts.context}</span> : null}
              <span>{dateParts.weekday || shift.date}</span>
              {dateParts.day ? <strong>{dateParts.day}</strong> : null}
              {dateParts.month ? <small>{dateParts.month}</small> : null}
            </div>

            <div className="shift-card__body">
              <div className="shift-heading-row">
                <div className="shift-heading-copy">
                  <h3>
                    <span className="line-pill">
                      <AssetIcon className="line-pill__mark" name="busMark" size={28} />
                      Linea {getLineDisplayName(dayData?.lineaNorm || shift.line)}
                    </span>
                    <span>Turno {shift.number}</span>
                  </h3>
                  {canFlipDevelopment ? (
                    <button className="flip-action flip-action--inline" onClick={() => setIsFlipped(true)} type="button">
                      Mostra sviluppo turno
                    </button>
                  ) : null}
                  <p className="shift-category-text">Categoria: {category?.label || 'Turno lavorativo'}</p>
                </div>
                <div className="shift-badge-row" aria-label="Classificazione turno">
                  {dayData?.isGerbidoLine ? <span className="shift-badge shift-badge--line">Gerbido</span> : null}
                  {dayData && !dayData.isGerbidoLine ? <span className="shift-badge shift-badge--rest">Linea non riconosciuta</span> : null}
                  {isSplit ? <span className="shift-badge shift-badge--warning">Spezzato</span> : null}
                  {showEveningBadge ? <span className="shift-badge shift-badge--evening">Serale</span> : null}
                  {isShortRest ? <span className="shift-badge shift-badge--rest">Riposo breve</span> : null}
                </div>
              </div>

              <div className="shift-route">
                <div>
                  <strong>{shift.start}</strong>
                  <span>
                    <Icon name="mapPin" size={14} />
                    {formatPlaceDirection(shift.startPlace, shift.startDirection || shift.direction)}
                  </span>
                  <small>Partenza</small>
                </div>
                <div className="route-line" aria-hidden="true" />
                <div>
                  <strong>{shift.end}</strong>
                  <span>
                    <Icon name="mapPin" size={14} />
                    {formatPlaceDirection(shift.endPlace, shift.endDirection)}
                  </span>
                  <small>Termine</small>
                </div>
              </div>
            </div>

            <div className="shift-calendar-zone">
              {calendarActions ? <CalendarActions actions={calendarActions(dayData, segments)} shareText={shareText} /> : null}
            </div>
          </div>

          <div className="shift-meta">
            {category?.label ? (
              <span className="shift-meta-chip shift-meta-chip--category">
                <AssetIcon name={categoryIconName} size={24} />
                {category.label}
              </span>
            ) : null}
            <span className="shift-meta-chip">
              <Icon name="compass" size={14} />
              Dir. {DIRECTION_LABELS[shift.direction] || shift.direction}
            </span>
            {shift.duration ? (
              <span className="shift-meta-chip">
                <Icon name="clock" size={14} />
                Dur. {shift.duration}
              </span>
            ) : null}
          </div>

          {!canFlipDevelopment ? (
            <DevelopmentPanel hasSegments={hasSegments} isSplit={isSplit} segments={segments} splitPause={splitPause} />
          ) : null}
        </div>

        {canFlipDevelopment ? (
          <div className="shift-card__face shift-card__face--back">
            <div className="development-back-header">
              <div>
                <p className="shift-date">{shift.date}</p>
                <h3>
                  Sviluppo turno · Linea {getLineDisplayName(dayData?.lineaNorm || shift.line)} / Turno {shift.number}
                </h3>
              </div>
              <button className="flip-action flip-action--ghost" onClick={() => setIsFlipped(false)} type="button">
                Torna al turno
              </button>
            </div>
            <DevelopmentPanel hasSegments={hasSegments} isSplit={isSplit} segments={segments} splitPause={splitPause} expanded />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DevelopmentPanel({ expanded = false, hasSegments, isSplit, segments, splitPause }) {
  return (
    <div className={expanded ? 'shift-development shift-development--expanded' : 'shift-development'} aria-label="Sviluppo turno">
      <h4>Sviluppo turno</h4>
      {hasSegments ? (
        <>
          {segments.map((segment, index) => (
            <div className={isSplit ? 'shift-segment is-split' : 'shift-segment'} key={`${segment.start}-${segment.end}-${index}`}>
              <span className="segment-index">{index + 1}</span>
              <strong>
                {segment.start} - {segment.end}
              </strong>
              <span>
                {segment.loc_s} {DIRECTION_LABELS[segment.dir] || segment.dir || '-'} {segment.loc_e}
              </span>
              {segment.vett || segment.turnoVettura ? (
                <small className="segment-vehicle">
                  {segment.vett ? `Vett. ${segment.vett}` : ''}
                  {segment.vett && segment.turnoVettura ? ' · ' : ''}
                  {segment.turnoVettura ? `Turno vett. ${formatVehicleShift(segment.turnoVettura)}` : ''}
                </small>
              ) : null}
            </div>
          ))}
          {splitPause !== null ? <p className="split-pause">Pausa tra le riprese: {formatMinutes(splitPause)}</p> : null}
        </>
      ) : (
        <p className="development-empty">Sviluppo non disponibile</p>
      )}
    </div>
  );
}

function CalendarActions({ actions, compact = false, shareText = '' }) {
  const [copied, setCopied] = useState(false);
  if (!actions) return null;

  async function copyShift() {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  function sendWhatsapp() {
    if (!shareText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={compact ? 'calendar-actions calendar-actions--compact calendar-actions--single' : 'calendar-actions calendar-actions--single'}>
      <button className="inline-action" onClick={actions.add} type="button">
        <Icon name="calendar" size={18} />
        {compact ? 'Aggiungi turno' : 'Aggiungi al calendario'}
      </button>
      <div className="share-actions">
        <button className="inline-action inline-action--whatsapp" onClick={sendWhatsapp} type="button">
          <Icon name="whatsapp" size={18} />
          WhatsApp
        </button>
        <button className="inline-action inline-action--copy" onClick={copyShift} type="button">
          <Icon name="copy" size={18} />
          {copied ? 'Copiato' : 'Copia turno'}
        </button>
      </div>
      {!compact ? <p>Si aprira il calendario del dispositivo per confermare l'aggiunta.</p> : null}
    </div>
  );
}
