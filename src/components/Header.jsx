import { AssetIcon } from './Icon.jsx';

const KPI_LABELS = [
  ['Turni', 'totalShifts'],
  ['Spezzati', 'splitShifts'],
  ['Serali', 'eveningShifts'],
  ['Riposi', 'restDays'],
  ['Ballottaggi', 'ballots'],
];

export function Header({ orariLoaded = false, pdfLoaded = false, period, person, stats }) {
  if (!pdfLoaded) {
    return (
      <header className="app-header app-header--empty">
        <div className="app-header__brand">
          <div className="app-logo" aria-hidden="true">
            <AssetIcon name="bus" size={42} />
          </div>
          <div className="app-title">
            <h1>Turni Smart</h1>
            <p>Turni GTT · Deposito Gerbido</p>
          </div>
        </div>
        <div className="header-empty-note">
          <strong>Importa la Preconoscenza</strong>
          <span>Gli Orari Linee sono opzionali e completano lo sviluppo turno.</span>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-logo" aria-hidden="true">
          <AssetIcon name="bus" size={42} />
        </div>
        <div className="app-title">
          <h1>Turni Smart</h1>
          <p>Turni GTT · Deposito Gerbido</p>
        </div>
      </div>

      <div className="header-driver">
        <span>{person || 'Carica la Preconoscenza per iniziare'}</span>
        <strong>Turni GTT · Deposito Gerbido</strong>
      </div>

      <div className="period-card" aria-label="Periodo attivo">
        <span>Periodo attivo</span>
        <strong>{period || 'Nessun periodo caricato'}</strong>
      </div>

      <div className="header-status" aria-label="Stato dati">
        <span className={pdfLoaded ? 'status-pill is-ok' : 'status-pill'}>Preconoscenza {pdfLoaded ? 'caricata' : 'non caricata'}</span>
        <span className={orariLoaded ? 'status-pill is-ok' : 'status-pill'}>Orari Linee {orariLoaded ? 'caricati' : 'non caricati'}</span>
      </div>

      {pdfLoaded ? (
        <div className="header-kpis" aria-label="Indicatori periodo">
          {KPI_LABELS.map(([label, key]) => (
            <div className="header-kpi" key={key}>
              <span>{label}</span>
              <strong>{stats?.[key] ?? 0}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
