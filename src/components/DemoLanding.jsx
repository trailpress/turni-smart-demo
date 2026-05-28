import { AssetIcon, Icon } from './Icon.jsx';

export function DemoLanding({ loading = false, onOpenDemo, onManualUpload }) {
  return (
    <main className="demo-landing" aria-labelledby="demo-landing-title">
      <section className="demo-hero">
        <div className="demo-hero__content">
          <div className="demo-hero__brand">
            <AssetIcon name="bus" size={58} />
            <span>Turni Smart</span>
          </div>
          <h1 id="demo-landing-title">Turni Smart - Demo</h1>
          <p className="demo-hero__subtitle">Prototipo dimostrativo per semplificare la consultazione dei turni e lo sviluppo dei turni spezzati.</p>
          <p className="demo-hero__text">
            Questa versione dimostrativa permette di visualizzare il funzionamento della webapp con dati precaricati. L'app lavora su documenti caricati
            manualmente e consente di consultare i turni, cercarli per data o periodo, evidenziare i turni spezzati e visualizzare lo sviluppo del turno.
          </p>
          <div className="demo-hero__actions">
            <button className="demo-primary-button" disabled={loading} onClick={onOpenDemo} type="button">
              <Icon name="calendar" size={22} />
              <span>{loading ? 'Caricamento...' : 'Apri demo'}</span>
            </button>
            <button className="demo-secondary-button" disabled={loading} onClick={onManualUpload} type="button">
              <Icon name="upload" size={22} />
              <span>Carica file manualmente</span>
            </button>
          </div>
        </div>
        <div className="demo-hero__panel" aria-label="Informazioni demo">
          <strong>Demo precaricata con dati di esempio.</strong>
          <span>La webapp non effettua login automatici, non interroga sistemi aziendali e non modifica dati esterni.</span>
        </div>
      </section>

      <section className="demo-capabilities" aria-labelledby="demo-capabilities-title">
        <div className="demo-section-title">
          <span>Cosa puoi provare nella demo</span>
          <h2 id="demo-capabilities-title">Funzioni principali</h2>
        </div>
        <div className="demo-capability-grid">
          {[
            ['search', 'consultare i turni del periodo caricato'],
            ['calendar', 'cercare un turno per data'],
            ['route', 'visualizzare i turni spezzati'],
            ['bus', 'vedere lo sviluppo del turno'],
            ['document', "esportare informazioni in formato calendario, se previsto dall'app originale"],
          ].map(([icon, label]) => (
            <article className="demo-capability" key={label}>
              <Icon name={icon} size={24} />
              <span>{label}</span>
            </article>
          ))}
        </div>
        <p className="demo-note">Prototipo sviluppato a titolo personale a scopo dimostrativo.</p>
      </section>
    </main>
  );
}
