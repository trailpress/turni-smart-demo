import { REST_CODES } from '../parserPreconoscenza.js';
import { Icon } from './Icon.jsx';

const monthFormatter = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric',
});

function getMonthLength(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function MonthView({ days: parsedDays = {}, monthDate = new Date(), onNextMonth, onPrevMonth, onSelectDay }) {
  const monthLength = getMonthLength(monthDate);
  const days = Array.from({ length: monthLength }, (_, index) => index + 1);
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const leadingEmptyDays = firstDay === 0 ? 6 : firstDay - 1;
  const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const today = new Date();

  function dayState(day) {
    const iso = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(
      day,
    ).padStart(2, '0')}`;
    const item = parsedDays[iso];

    return {
      hasShift: item?.t === 'turno',
      hasRest: Boolean(item && REST_CODES[item.t]),
      hasBallot: item?.t === 'RIS',
      hasOther: Boolean(item && item.t !== 'turno' && !REST_CODES[item.t] && item.t !== 'RIS'),
      isToday:
        today.getFullYear() === monthDate.getFullYear() &&
        today.getMonth() === monthDate.getMonth() &&
        today.getDate() === day,
    };
  }

  return (
    <section className="month-view mg" aria-labelledby="month-title">
      <div className="month-heading">
        <button onClick={onPrevMonth} type="button" aria-label="Mese precedente">
          <Icon name="chevronLeft" size={20} />
        </button>
        <h2 id="month-title">{monthFormatter.format(monthDate)}</h2>
        <button onClick={onNextMonth} type="button" aria-label="Mese successivo">
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
      <div className="month-grid month-grid--weekdays" aria-hidden="true">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-grid" aria-label="Vista mese preconoscenza">
        {Array.from({ length: leadingEmptyDays }, (_, index) => (
          <span className="month-day month-day--empty" key={`empty-${index}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const state = dayState(day);
          return (
            <button
              className={[
                'month-day',
                state.hasShift ? 'has-shift' : '',
                state.hasRest ? 'has-rest' : '',
                state.hasBallot ? 'has-ballot' : '',
                state.hasOther ? 'has-other' : '',
                state.isToday ? 'is-today' : '',
              ]
                .filter(Boolean)
              .join(' ')}
              key={day}
              onClick={() => onSelectDay?.(new Date(monthDate.getFullYear(), monthDate.getMonth(), day))}
              type="button"
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="month-legend">
        <span>
          <i className="legend-dot legend-dot--today" /> Oggi
        </span>
        <span>
          <i className="legend-dot legend-dot--shift" /> Turno
        </span>
        <span>
          <i className="legend-dot legend-dot--rest" /> Riposo
        </span>
        <span>
          <i className="legend-dot legend-dot--ballot" /> Ballott.
        </span>
        <span>
          <i className="legend-dot legend-dot--other" /> Altro
        </span>
      </div>
    </section>
  );
}
