import { AssetIcon, Icon } from './Icon.jsx';

export function OnboardingHome({ error = '', loading = false, onLoadDemo, onPrimaryUpload }) {
  return (
    <section className="onboarding-home" aria-labelledby="onboarding-title">
      <div className="onboarding-hero">
        <div className="onboarding-brand">
          <span className="onboarding-brand__icon" aria-hidden="true">
            <AssetIcon name="bus" size={54} />
          </span>
          <span className="onboarding-brand__text">
            <strong>Turni Smart</strong>
            <small>Turni GTT · Deposito Gerbido</small>
          </span>
        </div>
        <div className="onboarding-hero__mark" aria-hidden="true">
          <AssetIcon name="bus" size={132} />
        </div>
        <div className="onboarding-hero__copy">
          <h2 id="onboarding-title">Benvenuto!</h2>
          <p>Inizia caricando la tua preconoscenza</p>
        </div>
      </div>

      <button className="onboarding-upload" disabled={loading} onClick={onPrimaryUpload} type="button">
        <span className="onboarding-upload__icon">
          <AssetIcon name="upload" size={72} />
        </span>
        <span className="onboarding-upload__text">
          <strong>1. Carica preconoscenza</strong>
          <small>PDF mensile con i tuoi turni</small>
        </span>
        <Icon className="onboarding-upload__chevron" name="chevronRight" size={26} />
      </button>

      <button className="onboarding-demo" disabled={loading} onClick={onLoadDemo} type="button">
        <span className="onboarding-demo__icon" aria-hidden="true">
          <Icon name="calendar" size={24} />
        </span>
        <span>
          <strong>Prova l'app con dati demo</strong>
          <small>Carica un mese di esempio per vedere turni, calendario e statistiche. Per usarla davvero, carica la tua Preconoscenza.</small>
        </span>
      </button>
      {error ? <p className="onboarding-error">{error}</p> : null}
    </section>
  );
}
