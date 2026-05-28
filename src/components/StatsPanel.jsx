import { AssetIcon, Icon } from './Icon.jsx';

export function StatsPanel({ stats, title = 'Statistiche periodo' }) {
  const byLabel = Object.fromEntries(stats.map((stat) => [stat.label, stat.value]));
  const turni = Number(byLabel.Turni || 0);
  const riposi = Number(byLabel.Riposi || 0);
  const ballottaggi = Number(byLabel.Ballottaggi || 0);
  const spezzati = Number(byLabel.Spezzati || 0);
  const serali = Number(byLabel.Serali || 0);
  const totale = Math.max(turni + riposi + ballottaggi, 1);
  const maxBar = Math.max(turni, riposi, spezzati, serali, ballottaggi, 1);
  const workPercent = Math.round((turni / totale) * 100);
  const restPercent = Math.round((riposi / totale) * 100);
  const ballotPercent = Math.round((ballottaggi / totale) * 100);
  const bars = [
    { label: 'Turni', value: turni, icon: 'bus', color: '#0b7bd3' },
    { label: 'Riposi', value: riposi, icon: 'rest', color: '#1b7a3d' },
    { label: 'Spezzati', value: spezzati, icon: 'route', color: '#e65100' },
    { label: 'Serali', value: serali, icon: 'stats', color: '#5b189a' },
    { label: 'Ballottaggi', value: ballottaggi, icon: 'calendar', color: '#c62828' },
  ];

  return (
    <section className="stats-panel ps" aria-labelledby="stats-title">
      <div className="section-heading">
        <span className="section-heading__icon">
          <Icon name="chart" size={22} />
        </span>
        <h2 id="stats-title">{title}</h2>
      </div>

      <div className="stats-dashboard">
        <div
          className="stats-donut"
          style={{
            '--work': `${workPercent * 3.6}deg`,
            '--rest': `${(workPercent + restPercent) * 3.6}deg`,
          }}
          aria-label={`Periodo: ${workPercent}% turni, ${restPercent}% riposi, ${ballotPercent}% ballottaggi`}
        >
          <strong>{turni}</strong>
          <span>turni</span>
        </div>

        <div className="stats-bars">
          {bars.map((item) => (
            <div className="stat-row" key={item.label}>
              <span className="stat-row__icon" style={{ '--stat-color': item.color }}>
                <AssetIcon name={item.icon} size={30} />
              </span>
              <span className="stat-row__label">{item.label}</span>
              <strong>{item.value}</strong>
              <i style={{ '--stat-color': item.color, '--stat-width': `${Math.max(6, Math.round((item.value / maxBar) * 100))}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="stats-footer">
        {byLabel['Durata media'] ? (
          <span>
            <Icon name="clock" size={15} />
            Media {byLabel['Durata media']}
          </span>
        ) : null}
        {byLabel['Giorno lungo'] && byLabel['Giorno lungo'] !== '-' ? (
          <span>
            <Icon name="compass" size={15} />
            Piu lungo {byLabel['Giorno lungo']}
          </span>
        ) : null}
      </div>
    </section>
  );
}
